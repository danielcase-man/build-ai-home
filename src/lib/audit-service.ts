import { supabase } from './supabase'

export interface AuditEntry {
  id: string
  project_id: string
  entity_type: string
  entity_id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  actor: string
  created_at: string
}

export async function logChange(params: {
  projectId: string
  entityType: string
  entityId: string
  action: 'create' | 'update' | 'delete'
  fieldName?: string
  oldValue?: unknown
  newValue?: unknown
  actor?: string
}): Promise<void> {
  const { error } = await supabase
    .from('audit_log')
    .insert({
      project_id: params.projectId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      field_name: params.fieldName || null,
      old_value: params.oldValue !== undefined ? String(params.oldValue) : null,
      new_value: params.newValue !== undefined ? String(params.newValue) : null,
      actor: params.actor || 'system',
    })

  // Best-effort — silently ignore audit write failures
  if (error) return
}

export async function getEntityHistory(
  entityType: string,
  entityId: string,
  limit = 20
): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  return data || []
}

export function diffObject(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
  const diffs: Array<{ field: string; oldValue: unknown; newValue: unknown }> = []

  for (const key of Object.keys(newObj)) {
    const oldVal = oldObj[key]
    const newVal = newObj[key]

    // Skip metadata fields
    if (['id', 'project_id', 'created_at', 'updated_at'].includes(key)) continue

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({ field: key, oldValue: oldVal, newValue: newVal })
    }
  }

  return diffs
}

export async function logObjectChanges(params: {
  projectId: string
  entityType: string
  entityId: string
  oldObj: Record<string, unknown>
  newObj: Record<string, unknown>
  actor?: string
}): Promise<void> {
  const diffs = diffObject(params.oldObj, params.newObj)

  for (const diff of diffs) {
    await logChange({
      projectId: params.projectId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: 'update',
      fieldName: diff.field,
      oldValue: diff.oldValue,
      newValue: diff.newValue,
      actor: params.actor,
    })
  }
}
