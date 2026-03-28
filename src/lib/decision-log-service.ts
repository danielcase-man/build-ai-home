/**
 * Decision Log Service — CRUD for recording and tracking project decisions.
 *
 * Captures vendor selections, material choices, design changes, budget
 * adjustments, and schedule changes. Tracks outcomes to build institutional
 * knowledge about what worked and what didn't.
 */

import { supabase } from './supabase'
import type { DecisionLogEntry, DecisionType, OutcomeStatus, Bid } from '@/types'

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** Log a new decision */
export async function logDecision(
  entry: Omit<DecisionLogEntry, 'id' | 'created_at' | 'updated_at'>
): Promise<DecisionLogEntry | null> {
  const { data, error } = await supabase
    .from('decision_log')
    .insert(entry)
    .select()
    .single()

  if (error) {
    console.error('Error logging decision:', error)
    return null
  }
  return data as DecisionLogEntry
}

/** Convenience: log a vendor selection from a bid object */
export async function logVendorSelection(
  projectId: string,
  bid: Pick<Bid, 'id' | 'vendor_name' | 'category' | 'total_amount' | 'description'>,
  reasoning: string
): Promise<DecisionLogEntry | null> {
  const today = new Date().toISOString().slice(0, 10)

  return logDecision({
    project_id: projectId,
    decision_type: 'vendor_selection',
    category: bid.category,
    title: `Selected ${bid.vendor_name} for ${bid.category}`,
    description: bid.description,
    chosen_option: bid.vendor_name,
    reasoning,
    cost_impact: bid.total_amount,
    decided_by: 'Daniel Case',
    decided_date: today,
    related_bid_id: bid.id,
    outcome_status: 'pending',
  })
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Get decisions for a project with optional filters */
export async function getDecisions(
  projectId: string,
  filters?: { type?: DecisionType; category?: string }
): Promise<DecisionLogEntry[]> {
  let query = supabase
    .from('decision_log')
    .select('*')
    .eq('project_id', projectId)
    .order('decided_date', { ascending: false })

  if (filters?.type) query = query.eq('decision_type', filters.type)
  if (filters?.category) query = query.eq('category', filters.category)

  const { data, error } = await query
  if (error) return []
  return (data || []) as DecisionLogEntry[]
}

/** Get decisions from the last N days */
export async function getRecentDecisions(
  projectId: string,
  days: number
): Promise<DecisionLogEntry[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('decision_log')
    .select('*')
    .eq('project_id', projectId)
    .gte('decided_date', since)
    .order('decided_date', { ascending: false })

  if (error) return []
  return (data || []) as DecisionLogEntry[]
}

/** Get decisions related to a specific vendor */
export async function getDecisionsByVendor(
  projectId: string,
  vendorId: string
): Promise<DecisionLogEntry[]> {
  const { data, error } = await supabase
    .from('decision_log')
    .select('*')
    .eq('project_id', projectId)
    .eq('related_vendor_id', vendorId)
    .order('decided_date', { ascending: false })

  if (error) return []
  return (data || []) as DecisionLogEntry[]
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/** Update the outcome of a decision */
export async function updateOutcome(
  id: string,
  outcome: { status: OutcomeStatus; notes?: string }
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('decision_log')
    .update({
      outcome_status: outcome.status,
      outcome_notes: outcome.notes,
      outcome_date: today,
    })
    .eq('id', id)

  return !error
}
