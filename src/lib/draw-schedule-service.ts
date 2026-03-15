/**
 * Draw Schedule Service — construction loan disbursement tracking.
 *
 * Ties loan draws to milestone completion. Each draw requires inspection,
 * approval, and funding. Integrates with the Plaid agent's payments/
 * transactions tables when available.
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DrawStatus = 'pending' | 'requested' | 'inspected' | 'approved' | 'funded'

export interface DrawScheduleItem {
  id?: string
  project_id: string
  loan_id: string | null
  draw_number: number
  milestone_id: string | null
  milestone_name: string | null
  amount: number
  status: DrawStatus
  request_date: string | null
  inspection_date: string | null
  approval_date: string | null
  funded_date: string | null
  retention_amount: number | null
  inspector_name: string | null
  inspector_notes: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

export async function getDrawSchedule(projectId: string): Promise<DrawScheduleItem[]> {
  const { data, error } = await supabase
    .from('draw_schedule')
    .select('*')
    .eq('project_id', projectId)
    .order('draw_number', { ascending: true })

  if (error) return []
  return (data || []) as DrawScheduleItem[]
}

export async function getDrawSummary(projectId: string): Promise<{
  total_draws: number
  total_amount: number
  funded_amount: number
  pending_amount: number
  next_draw: DrawScheduleItem | null
}> {
  const draws = await getDrawSchedule(projectId)
  const funded = draws.filter(d => d.status === 'funded')
  const pending = draws.filter(d => d.status !== 'funded')
  const next = pending[0] || null

  return {
    total_draws: draws.length,
    total_amount: draws.reduce((s, d) => s + d.amount, 0),
    funded_amount: funded.reduce((s, d) => s + d.amount, 0),
    pending_amount: pending.reduce((s, d) => s + d.amount, 0),
    next_draw: next,
  }
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

export async function createDraw(
  draw: Omit<DrawScheduleItem, 'id' | 'draw_number' | 'created_at' | 'updated_at'>
): Promise<DrawScheduleItem | null> {
  const { data: existing } = await supabase
    .from('draw_schedule')
    .select('draw_number')
    .eq('project_id', draw.project_id)
    .order('draw_number', { ascending: false })
    .limit(1)
    .single()

  const nextNumber = (existing?.draw_number || 0) + 1

  const { data, error } = await supabase
    .from('draw_schedule')
    .insert({ ...draw, draw_number: nextNumber })
    .select()
    .single()

  if (error) {
    console.error('Error creating draw:', error)
    return null
  }
  return data as DrawScheduleItem
}

export async function updateDrawStatus(
  id: string,
  status: DrawStatus,
  details?: { inspection_date?: string; approval_date?: string; funded_date?: string; inspector_name?: string; inspector_notes?: string; notes?: string }
): Promise<boolean> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }

  if (status === 'requested') updates.request_date = new Date().toISOString().split('T')[0]
  if (status === 'inspected' && details?.inspection_date) updates.inspection_date = details.inspection_date
  if (status === 'approved' && details?.approval_date) updates.approval_date = details.approval_date
  if (status === 'funded' && details?.funded_date) updates.funded_date = details.funded_date
  if (details?.inspector_name) updates.inspector_name = details.inspector_name
  if (details?.inspector_notes) updates.inspector_notes = details.inspector_notes
  if (details?.notes) updates.notes = details.notes

  const { error } = await supabase
    .from('draw_schedule')
    .update(updates)
    .eq('id', id)

  return !error
}
