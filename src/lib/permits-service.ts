/**
 * Permits Service — CRUD + lifecycle tracking for construction permits.
 *
 * Tracks required permits through: not_started → applied → under_review →
 * approved → active → expired. Flags overdue and expiring permits.
 */

import { supabase } from './supabase'

export interface Permit {
  id: string
  project_id: string
  type: string
  permit_number?: string | null
  application_date?: string | null
  approval_date?: string | null
  expiration_date?: string | null
  status: 'not_started' | 'applied' | 'under_review' | 'approved' | 'active' | 'expired' | 'denied'
  inspection_dates?: Array<{ date: string; type: string; result?: string; inspector?: string; notes?: string }> | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface PermitAlert {
  permitId: string
  type: string
  status: string
  alertType: 'not_started' | 'expiring_soon' | 'expired' | 'overdue_inspection'
  message: string
  daysUntil?: number
}

// Known required permits for residential construction in Williamson County, TX
export const REQUIRED_PERMITS: Array<{ type: string; description: string; prerequisite?: string }> = [
  { type: 'Building Permit', description: 'Primary building permit from Williamson County', prerequisite: 'Approved plans + septic permit' },
  { type: 'OSSF Septic Permit', description: 'On-Site Sewage Facility permit for aerobic septic system', prerequisite: 'Grading plan + septic design' },
  { type: 'Electrical Service', description: 'PEC (Pedernales Electric Co-op) electrical service application' },
  { type: 'Well Permit', description: 'Water well drilling permit' },
  { type: 'Driveway/Access Permit', description: 'County road access / driveway cut permit' },
  { type: 'Stormwater/Drainage', description: 'Stormwater management / drainage plan approval' },
]

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getPermits(projectId: string): Promise<Permit[]> {
  const { data, error } = await supabase
    .from('permits')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching permits:', error)
    return []
  }
  return (data || []) as Permit[]
}

export async function getPermit(permitId: string): Promise<Permit | null> {
  const { data, error } = await supabase
    .from('permits')
    .select('*')
    .eq('id', permitId)
    .single()

  if (error) return null
  return data as Permit
}

export async function createPermit(
  permit: Omit<Permit, 'id' | 'created_at' | 'updated_at'>
): Promise<Permit | null> {
  const { data, error } = await supabase
    .from('permits')
    .insert(permit)
    .select()
    .single()

  if (error) {
    console.error('Error creating permit:', error)
    return null
  }
  return data as Permit
}

export async function updatePermit(
  permitId: string,
  updates: Partial<Pick<Permit, 'status' | 'permit_number' | 'application_date' | 'approval_date' | 'expiration_date' | 'inspection_dates' | 'notes'>>
): Promise<Permit | null> {
  const { data, error } = await supabase
    .from('permits')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', permitId)
    .select()
    .single()

  if (error) {
    console.error('Error updating permit:', error)
    return null
  }
  return data as Permit
}

export async function addInspection(
  permitId: string,
  inspection: { date: string; type: string; result?: string; inspector?: string; notes?: string }
): Promise<Permit | null> {
  const permit = await getPermit(permitId)
  if (!permit) return null

  const inspections = permit.inspection_dates || []
  inspections.push(inspection)

  return updatePermit(permitId, { inspection_dates: inspections })
}

// ---------------------------------------------------------------------------
// Alerts & Status
// ---------------------------------------------------------------------------

export function getPermitAlerts(permits: Permit[]): PermitAlert[] {
  const alerts: PermitAlert[] = []
  const now = new Date()

  for (const permit of permits) {
    // Not started — required permits that haven't been applied for
    if (permit.status === 'not_started') {
      alerts.push({
        permitId: permit.id,
        type: permit.type,
        status: permit.status,
        alertType: 'not_started',
        message: `${permit.type} has not been applied for yet`,
      })
    }

    // Expiring soon (within 30 days)
    if (permit.expiration_date && ['approved', 'active'].includes(permit.status)) {
      const expDate = new Date(permit.expiration_date)
      const daysUntil = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntil < 0) {
        alerts.push({
          permitId: permit.id,
          type: permit.type,
          status: permit.status,
          alertType: 'expired',
          message: `${permit.type} expired ${Math.abs(daysUntil)} days ago`,
          daysUntil,
        })
      } else if (daysUntil <= 30) {
        alerts.push({
          permitId: permit.id,
          type: permit.type,
          status: permit.status,
          alertType: 'expiring_soon',
          message: `${permit.type} expires in ${daysUntil} days`,
          daysUntil,
        })
      }
    }
  }

  return alerts.sort((a, b) => {
    const priority = { expired: 0, not_started: 1, expiring_soon: 2, overdue_inspection: 3 }
    return (priority[a.alertType] ?? 4) - (priority[b.alertType] ?? 4)
  })
}

// ---------------------------------------------------------------------------
// Seed required permits
// ---------------------------------------------------------------------------

export async function seedRequiredPermits(projectId: string): Promise<{ created: number; skipped: number }> {
  const existing = await getPermits(projectId)
  const existingTypes = new Set(existing.map(p => p.type))

  let created = 0
  let skipped = 0

  for (const required of REQUIRED_PERMITS) {
    if (existingTypes.has(required.type)) {
      skipped++
      continue
    }

    await createPermit({
      project_id: projectId,
      type: required.type,
      status: 'not_started',
      notes: required.description + (required.prerequisite ? `\nPrerequisite: ${required.prerequisite}` : ''),
    })
    created++
  }

  return { created, skipped }
}
