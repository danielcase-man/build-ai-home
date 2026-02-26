import { supabase } from './supabase'
import { getProject } from './project-service'
import type { PendingAction } from '@/types'

interface ActionResult {
  success: boolean
  message: string
  data?: unknown
}

export async function executeAction(action: PendingAction): Promise<ActionResult> {
  const project = await getProject()
  if (!project) return { success: false, message: 'No project found' }

  switch (action.type) {
    case 'update_bid':
      return updateBid(project.id, action.data)
    case 'add_bid':
      return addBid(project.id, action.data)
    case 'update_budget_item':
      return updateBudgetItem(project.id, action.data)
    case 'add_budget_item':
      return addBudgetItem(project.id, action.data)
    case 'update_selection':
      return updateSelection(project.id, action.data)
    case 'add_contact':
      return addContact(project.id, action.data)
    case 'update_planning_step':
      return updatePlanningStep(project.id, action.data)
    default:
      return { success: false, message: `Unknown action type: ${action.type}` }
  }
}

async function updateBid(projectId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { vendor_name, category, ...updates } = data

  let query = supabase
    .from('bids')
    .select('id, vendor_name, category, total_amount')
    .eq('project_id', projectId)
    .ilike('vendor_name', `%${vendor_name}%`)

  if (category) {
    query = query.ilike('category', `%${category}%`)
  }

  const { data: matches, error: findError } = await query

  if (findError || !matches?.length) {
    return { success: false, message: `No bid found matching "${vendor_name}"` }
  }

  if (matches.length > 1) {
    const names = matches.map(m => `${m.vendor_name} (${m.category})`).join(', ')
    return { success: false, message: `Multiple bids match "${vendor_name}": ${names}. Please be more specific.` }
  }

  const bid = matches[0]
  const { error } = await supabase
    .from('bids')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', bid.id)

  if (error) return { success: false, message: `Database error: ${error.message}` }

  return {
    success: true,
    message: `Updated ${bid.vendor_name} bid${updates.total_amount ? ` to $${(updates.total_amount as number).toLocaleString()}` : ''}`,
    data: { bidId: bid.id, previousAmount: bid.total_amount, ...updates },
  }
}

async function addBid(projectId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { error, data: inserted } = await supabase
    .from('bids')
    .insert([{
      project_id: projectId,
      vendor_name: data.vendor_name,
      category: data.category,
      subcategory: data.subcategory || null,
      description: data.description || '',
      total_amount: data.total_amount,
      vendor_email: data.vendor_email || null,
      vendor_phone: data.vendor_phone || null,
      scope_of_work: data.scope_of_work || null,
      lead_time_weeks: data.lead_time_weeks || null,
      payment_terms: data.payment_terms || null,
      internal_notes: data.notes || null,
      status: 'pending',
      ai_extracted: false,
      needs_review: false,
      received_date: new Date().toISOString().split('T')[0],
    }])
    .select()
    .single()

  if (error) return { success: false, message: `Database error: ${error.message}` }

  return {
    success: true,
    message: `Added new bid from ${data.vendor_name} for ${data.category}: $${(data.total_amount as number).toLocaleString()}`,
    data: inserted,
  }
}

async function updateBudgetItem(projectId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { category, description, ...updates } = data

  let query = supabase
    .from('budget_items')
    .select('id, category, description, estimated_cost, actual_cost')
    .eq('project_id', projectId)
    .ilike('category', `%${category}%`)

  if (description) {
    query = query.ilike('description', `%${description}%`)
  }

  const { data: matches, error: findError } = await query

  if (findError || !matches?.length) {
    return { success: false, message: `No budget item found matching "${category}"` }
  }

  if (matches.length > 1 && !description) {
    const items = matches.map(m => `${m.category}: ${m.description}`).join(', ')
    return { success: false, message: `Multiple budget items match "${category}": ${items}. Please be more specific.` }
  }

  const item = matches[0]
  const { error } = await supabase
    .from('budget_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', item.id)

  if (error) return { success: false, message: `Database error: ${error.message}` }

  return {
    success: true,
    message: `Updated budget item "${item.category}: ${item.description}"`,
    data: { itemId: item.id, ...updates },
  }
}

async function addBudgetItem(projectId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { error, data: inserted } = await supabase
    .from('budget_items')
    .insert([{
      project_id: projectId,
      category: data.category,
      subcategory: data.subcategory || null,
      description: data.description,
      estimated_cost: data.estimated_cost,
      actual_cost: data.actual_cost || null,
      status: data.status || 'pending',
      notes: data.notes || null,
    }])
    .select()
    .single()

  if (error) return { success: false, message: `Database error: ${error.message}` }

  return {
    success: true,
    message: `Added budget item: ${data.description} ($${(data.estimated_cost as number).toLocaleString()})`,
    data: inserted,
  }
}

async function updateSelection(projectId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { product_name, room, ...updates } = data

  let query = supabase
    .from('selections')
    .select('id, product_name, room, category, status')
    .eq('project_id', projectId)
    .ilike('product_name', `%${product_name}%`)

  if (room) {
    query = query.ilike('room', `%${room}%`)
  }

  const { data: matches, error: findError } = await query

  if (findError || !matches?.length) {
    return { success: false, message: `No selection found matching "${product_name}"` }
  }

  if (matches.length > 1) {
    const items = matches.map(m => `${m.product_name} (${m.room})`).join(', ')
    return { success: false, message: `Multiple selections match "${product_name}": ${items}. Please specify the room.` }
  }

  const selection = matches[0]
  const { error } = await supabase
    .from('selections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', selection.id)

  if (error) return { success: false, message: `Database error: ${error.message}` }

  return {
    success: true,
    message: `Updated selection "${selection.product_name}" in ${selection.room}`,
    data: { selectionId: selection.id, ...updates },
  }
}

async function addContact(projectId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { error, data: inserted } = await supabase
    .from('contacts')
    .insert([{
      project_id: projectId,
      name: data.name,
      role: data.role,
      company: data.company || null,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
    }])
    .select()
    .single()

  if (error) return { success: false, message: `Database error: ${error.message}` }

  return {
    success: true,
    message: `Added contact: ${data.name} (${data.role})`,
    data: inserted,
  }
}

async function updatePlanningStep(projectId: string, data: Record<string, unknown>): Promise<ActionResult> {
  const { step_number, status, notes } = data

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (notes) updateData.notes = notes

  const { error, data: updated } = await supabase
    .from('planning_phase_steps')
    .update(updateData)
    .eq('project_id', projectId)
    .eq('step_number', step_number)
    .select()
    .single()

  if (error) return { success: false, message: `Database error: ${error.message}` }
  if (!updated) return { success: false, message: `Planning step ${step_number} not found` }

  return {
    success: true,
    message: `Updated Step ${step_number} to "${status}"`,
    data: updated,
  }
}
