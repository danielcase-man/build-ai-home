/**
 * Punch List Service — manages punch list items and inspections.
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PunchSeverity = 'cosmetic' | 'functional' | 'safety' | 'structural'
export type PunchStatus = 'identified' | 'assigned' | 'in_progress' | 'completed' | 'verified'
export type PunchSource = 'walkthrough' | 'inspection' | 'owner' | 'consultant'

export type InspectionStatus = 'not_scheduled' | 'scheduled' | 'passed' | 'failed' | 'conditional'

export interface PunchListItem {
  id?: string
  project_id: string
  room: string | null
  location_detail: string | null
  category: string | null
  description: string
  severity: PunchSeverity
  status: PunchStatus
  assigned_vendor_id: string | null
  assigned_vendor_name: string | null
  before_photo_id: string | null
  after_photo_id: string | null
  source: PunchSource
  due_date: string | null
  completed_date: string | null
  notes: string | null
  created_at?: string
}

export interface Inspection {
  id?: string
  project_id: string
  inspection_type: string
  knowledge_id: string | null
  permit_id: string | null
  status: InspectionStatus
  scheduled_date: string | null
  completed_date: string | null
  inspector_name: string | null
  deficiencies: Array<{ description: string; severity: string; corrected: boolean }>
  photos: string[]
  notes: string | null
  created_at?: string
}

// ---------------------------------------------------------------------------
// Punch List Operations
// ---------------------------------------------------------------------------

export async function getPunchList(
  projectId: string,
  filters?: { room?: string; severity?: PunchSeverity; status?: PunchStatus; category?: string }
): Promise<PunchListItem[]> {
  let query = supabase
    .from('punch_list_items')
    .select('*')
    .eq('project_id', projectId)
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false })

  if (filters?.room) query = query.eq('room', filters.room)
  if (filters?.severity) query = query.eq('severity', filters.severity)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.category) query = query.eq('category', filters.category)

  const { data, error } = await query
  if (error) return []
  return (data || []) as PunchListItem[]
}

export async function getPunchListStats(projectId: string): Promise<{
  total: number
  bySeverity: Record<string, number>
  byStatus: Record<string, number>
  byRoom: Record<string, number>
  completionRate: number
}> {
  const items = await getPunchList(projectId)

  const bySeverity: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const byRoom: Record<string, number> = {}

  for (const item of items) {
    bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1
    byStatus[item.status] = (byStatus[item.status] || 0) + 1
    const room = item.room || 'General'
    byRoom[room] = (byRoom[room] || 0) + 1
  }

  const completed = items.filter(i => i.status === 'completed' || i.status === 'verified').length

  return {
    total: items.length,
    bySeverity,
    byStatus,
    byRoom,
    completionRate: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
  }
}

export async function createPunchItem(
  item: Omit<PunchListItem, 'id' | 'created_at'>
): Promise<PunchListItem | null> {
  const { data, error } = await supabase
    .from('punch_list_items')
    .insert(item)
    .select()
    .single()

  if (error) {
    console.error('Error creating punch list item:', error)
    return null
  }
  return data as PunchListItem
}

export async function updatePunchItem(
  id: string,
  updates: Partial<Pick<PunchListItem, 'status' | 'assigned_vendor_id' | 'assigned_vendor_name' | 'after_photo_id' | 'completed_date' | 'notes'>>
): Promise<boolean> {
  const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }

  if (updates.status === 'completed') {
    payload.completed_date = updates.completed_date || new Date().toISOString().split('T')[0]
  }

  const { error } = await supabase
    .from('punch_list_items')
    .update(payload)
    .eq('id', id)

  return !error
}

/** Mark punch item resolved with after photo evidence */
export async function markPunchResolved(
  itemId: string,
  afterPhotoId: string
): Promise<boolean> {
  return updatePunchItem(itemId, {
    status: 'completed',
    after_photo_id: afterPhotoId,
    completed_date: new Date().toISOString().split('T')[0],
  })
}

/** Create punch items from a failed inspection's deficiencies */
export async function createFromInspection(
  projectId: string,
  inspectionId: string,
  deficiencies: Array<{ description: string; severity: string }>
): Promise<{ created: number }> {
  let created = 0
  for (const deficiency of deficiencies) {
    const item = await createPunchItem({
      project_id: projectId,
      room: null,
      location_detail: null,
      category: null,
      description: deficiency.description,
      severity: (deficiency.severity as PunchSeverity) || 'functional',
      status: 'identified',
      assigned_vendor_id: null,
      assigned_vendor_name: null,
      before_photo_id: null,
      after_photo_id: null,
      source: 'inspection',
      due_date: null,
      completed_date: null,
      notes: `From inspection ${inspectionId}`,
    })
    if (item) created++
  }
  return { created }
}

// ---------------------------------------------------------------------------
// Inspection Operations
// ---------------------------------------------------------------------------

export async function getInspections(
  projectId: string,
  filters?: { status?: InspectionStatus }
): Promise<Inspection[]> {
  let query = supabase
    .from('inspections')
    .select('*')
    .eq('project_id', projectId)
    .order('scheduled_date', { ascending: true })

  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) return []
  return (data || []) as Inspection[]
}

export async function scheduleInspection(
  inspection: Omit<Inspection, 'id' | 'created_at'>
): Promise<Inspection | null> {
  const { data, error } = await supabase
    .from('inspections')
    .insert({
      ...inspection,
      status: inspection.scheduled_date ? 'scheduled' : 'not_scheduled',
    })
    .select()
    .single()

  if (error) {
    console.error('Error scheduling inspection:', error)
    return null
  }
  return data as Inspection
}

export async function recordInspectionResult(
  id: string,
  result: {
    status: 'passed' | 'failed' | 'conditional'
    inspector_name?: string
    deficiencies?: Array<{ description: string; severity: string; corrected: boolean }>
    photos?: string[]
    notes?: string
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('inspections')
    .update({
      status: result.status,
      completed_date: new Date().toISOString().split('T')[0],
      inspector_name: result.inspector_name || null,
      deficiencies: result.deficiencies || [],
      photos: result.photos || [],
      notes: result.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return !error
}
