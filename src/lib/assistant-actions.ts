/**
 * Assistant write-action executor.
 *
 * Each PendingAction produced by a write tool is executed here after user
 * confirmation via the /api/assistant/apply-action endpoint.
 */

import type { PendingAction } from '@/types'
import { supabase } from './supabase'
import { getProject } from './project-service'

export interface ActionResult {
  success: boolean
  message: string
}

export async function executeAction(action: PendingAction): Promise<ActionResult> {
  const project = await getProject()
  if (!project) {
    return { success: false, message: 'No project found' }
  }
  const projectId = project.id as string

  switch (action.type) {
    case 'update_bid':
      return updateBid(action.data)
    case 'add_bid':
      return addBid(action.data, projectId)
    case 'update_selection':
      return updateSelection(action.data)
    case 'add_selection':
      return addSelection(action.data, projectId)
    case 'update_budget_item':
      return updateBudgetItem(action.data)
    case 'add_budget_item':
      return addBudgetItem(action.data, projectId)
    case 'update_milestone':
      return updateMilestone(action.data)
    default:
      return { success: false, message: `Unknown action type: ${action.type}` }
  }
}

// ---------------------------------------------------------------------------
// Bid mutations
// ---------------------------------------------------------------------------

async function updateBid(data: Record<string, unknown>): Promise<ActionResult> {
  const { bid_id, ...updates } = data
  if (!bid_id) return { success: false, message: 'Missing bid_id' }

  const { error } = await supabase
    .from('bids')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', bid_id as string)

  if (error) return { success: false, message: `Failed to update bid: ${error.message}` }
  return { success: true, message: `Bid ${bid_id} updated` }
}

async function addBid(data: Record<string, unknown>, projectId: string): Promise<ActionResult> {
  const now = new Date().toISOString()
  const { error, data: inserted } = await supabase
    .from('bids')
    .insert({
      project_id: projectId,
      vendor_name: data.vendor_name,
      vendor_email: data.vendor_email || null,
      vendor_phone: data.vendor_phone || null,
      category: data.category,
      subcategory: data.subcategory || null,
      description: data.description,
      total_amount: data.total_amount,
      scope_of_work: data.scope_of_work || null,
      inclusions: data.inclusions || null,
      exclusions: data.exclusions || null,
      lead_time_weeks: data.lead_time_weeks || null,
      internal_notes: data.internal_notes || null,
      status: 'pending',
      ai_extracted: false,
      needs_review: false,
      bid_date: now.split('T')[0],
      received_date: now.split('T')[0],
      source: 'assistant',
    })
    .select('id')
    .single()

  if (error) return { success: false, message: `Failed to add bid: ${error.message}` }
  return { success: true, message: `Bid added: ${data.vendor_name} — ${data.category} (id: ${inserted?.id})` }
}

// ---------------------------------------------------------------------------
// Selection mutations
// ---------------------------------------------------------------------------

async function updateSelection(data: Record<string, unknown>): Promise<ActionResult> {
  const { selection_id, ...updates } = data
  if (!selection_id) return { success: false, message: 'Missing selection_id' }

  const { error } = await supabase
    .from('selections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', selection_id as string)

  if (error) return { success: false, message: `Failed to update selection: ${error.message}` }
  return { success: true, message: `Selection ${selection_id} updated` }
}

async function addSelection(data: Record<string, unknown>, projectId: string): Promise<ActionResult> {
  const { error, data: inserted } = await supabase
    .from('selections')
    .insert({
      project_id: projectId,
      room: data.room,
      category: data.category,
      subcategory: data.subcategory || null,
      product_name: data.product_name,
      brand: data.brand || null,
      model_number: data.model_number || null,
      finish: data.finish || null,
      color: data.color || null,
      quantity: data.quantity || 1,
      unit_price: data.unit_price || null,
      total_price: data.total_price || null,
      status: (data.status as string) || 'considering',
      notes: data.notes || null,
      product_url: data.product_url || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, message: `Failed to add selection: ${error.message}` }
  return { success: true, message: `Selection added: ${data.product_name} in ${data.room} (id: ${inserted?.id})` }
}

// ---------------------------------------------------------------------------
// Budget mutations
// ---------------------------------------------------------------------------

async function updateBudgetItem(data: Record<string, unknown>): Promise<ActionResult> {
  const { budget_item_id, ...updates } = data
  if (!budget_item_id) return { success: false, message: 'Missing budget_item_id' }

  const { error } = await supabase
    .from('budget_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', budget_item_id as string)

  if (error) return { success: false, message: `Failed to update budget item: ${error.message}` }
  return { success: true, message: `Budget item ${budget_item_id} updated` }
}

async function addBudgetItem(data: Record<string, unknown>, projectId: string): Promise<ActionResult> {
  const { error, data: inserted } = await supabase
    .from('budget_items')
    .insert({
      project_id: projectId,
      category: data.category,
      subcategory: data.subcategory || null,
      description: data.description,
      estimated_cost: data.estimated_cost,
      actual_cost: data.actual_cost || null,
      status: (data.status as string) || 'estimated',
      notes: data.notes || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, message: `Failed to add budget item: ${error.message}` }
  return { success: true, message: `Budget item added: ${data.category} — ${data.description} (id: ${inserted?.id})` }
}

// ---------------------------------------------------------------------------
// Milestone mutations
// ---------------------------------------------------------------------------

async function updateMilestone(data: Record<string, unknown>): Promise<ActionResult> {
  const { milestone_id, ...updates } = data
  if (!milestone_id) return { success: false, message: 'Missing milestone_id' }

  const { error } = await supabase
    .from('milestones')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', milestone_id as string)

  if (error) return { success: false, message: `Failed to update milestone: ${error.message}` }
  return { success: true, message: `Milestone ${milestone_id} updated` }
}
