/**
 * Change Order Service — manages scope/cost changes during construction.
 *
 * Change orders modify the project scope, budget, and schedule. They link
 * to milestones and budget items, and integrate with the Plaid agent's
 * contracts table via contract_id when available.
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeOrderReason =
  | 'owner_request'
  | 'field_condition'
  | 'code_requirement'
  | 'design_change'
  | 'value_engineering'

export type ChangeOrderStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'completed'

export interface ChangeOrder {
  id?: string
  project_id: string
  change_order_number: number
  title: string
  description: string
  category: string | null
  requested_by: string | null
  reason: ChangeOrderReason
  status: ChangeOrderStatus
  cost_impact: number
  schedule_impact_days: number | null
  affected_milestone_id: string | null
  affected_budget_items: string[] | null
  contract_id: string | null
  approved_date: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

export async function getChangeOrders(
  projectId: string,
  filters?: { status?: ChangeOrderStatus; reason?: ChangeOrderReason }
): Promise<ChangeOrder[]> {
  let query = supabase
    .from('change_orders')
    .select('*')
    .eq('project_id', projectId)
    .order('change_order_number', { ascending: true })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.reason) query = query.eq('reason', filters.reason)

  const { data, error } = await query
  if (error) return []
  return (data || []) as ChangeOrder[]
}

export async function getChangeOrderSummary(projectId: string): Promise<{
  total: number
  approved: number
  pending: number
  total_cost_impact: number
  total_schedule_impact_days: number
}> {
  const orders = await getChangeOrders(projectId)
  const approved = orders.filter(o => o.status === 'approved' || o.status === 'completed')
  const pending = orders.filter(o => o.status === 'draft' || o.status === 'submitted')

  return {
    total: orders.length,
    approved: approved.length,
    pending: pending.length,
    total_cost_impact: approved.reduce((s, o) => s + (o.cost_impact || 0), 0),
    total_schedule_impact_days: approved.reduce((s, o) => s + (o.schedule_impact_days || 0), 0),
  }
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

export async function createChangeOrder(
  order: Omit<ChangeOrder, 'id' | 'change_order_number' | 'created_at' | 'updated_at'>
): Promise<ChangeOrder | null> {
  // Get next CO number
  const { data: existing } = await supabase
    .from('change_orders')
    .select('change_order_number')
    .eq('project_id', order.project_id)
    .order('change_order_number', { ascending: false })
    .limit(1)
    .single()

  const nextNumber = (existing?.change_order_number || 0) + 1

  const { data, error } = await supabase
    .from('change_orders')
    .insert({
      ...order,
      change_order_number: nextNumber,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating change order:', error)
    return null
  }
  return data as ChangeOrder
}

export async function updateChangeOrder(
  id: string,
  updates: Partial<Pick<ChangeOrder, 'status' | 'cost_impact' | 'schedule_impact_days' | 'notes' | 'approved_date'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('change_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error updating change order:', error)
    return false
  }
  return true
}
