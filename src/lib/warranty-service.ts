/**
 * Warranty & Compliance Service — tracks warranties and subcontractor insurance.
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired' | 'claimed'

export interface Warranty {
  id?: string
  project_id: string
  vendor_id: string | null
  vendor_name: string | null
  category: string
  item_description: string
  warranty_type: 'workmanship' | 'materials' | 'manufacturer' | 'structural'
  start_date: string
  end_date: string
  duration_months: number
  coverage_details: string | null
  status: WarrantyStatus
  created_at?: string
  updated_at?: string
}

export interface SubcontractorCompliance {
  id?: string
  project_id: string
  vendor_id: string | null
  vendor_name: string | null
  insurance_type: 'GL' | 'WC' | 'auto' | 'umbrella' | 'professional'
  policy_number: string | null
  carrier: string | null
  coverage_amount: number | null
  effective_date: string
  expiration_date: string
  verified: boolean
  created_at?: string
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Warranty Operations
// ---------------------------------------------------------------------------

export async function getWarranties(
  projectId: string,
  filters?: { status?: WarrantyStatus; vendor_id?: string }
): Promise<Warranty[]> {
  let query = supabase
    .from('warranties')
    .select('*')
    .eq('project_id', projectId)
    .order('end_date', { ascending: true })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.vendor_id) query = query.eq('vendor_id', filters.vendor_id)

  const { data, error } = await query
  if (error) return []

  // Auto-compute status based on dates
  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  return (data || []).map(w => {
    const end = new Date(w.end_date)
    let status = w.status as WarrantyStatus
    if (status !== 'claimed') {
      if (end < now) status = 'expired'
      else if (end < thirtyDays) status = 'expiring_soon'
      else status = 'active'
    }
    return { ...w, status } as Warranty
  })
}

export async function getExpiringWarranties(projectId: string, daysAhead = 30): Promise<Warranty[]> {
  const warranties = await getWarranties(projectId)
  return warranties.filter(w => w.status === 'expiring_soon')
}

export async function createWarranty(
  warranty: Omit<Warranty, 'id' | 'created_at' | 'updated_at'>
): Promise<Warranty | null> {
  const { data, error } = await supabase
    .from('warranties')
    .insert(warranty)
    .select()
    .single()

  if (error) {
    console.error('Error creating warranty:', error)
    return null
  }
  return data as Warranty
}

// ---------------------------------------------------------------------------
// Compliance Operations
// ---------------------------------------------------------------------------

export async function getCompliance(
  projectId: string,
  filters?: { vendor_id?: string }
): Promise<SubcontractorCompliance[]> {
  let query = supabase
    .from('subcontractor_compliance')
    .select('*')
    .eq('project_id', projectId)
    .order('expiration_date', { ascending: true })

  if (filters?.vendor_id) query = query.eq('vendor_id', filters.vendor_id)

  const { data, error } = await query
  if (error) return []
  return (data || []) as SubcontractorCompliance[]
}

export async function getComplianceGaps(projectId: string): Promise<{
  expired: SubcontractorCompliance[]
  expiring_soon: SubcontractorCompliance[]
  unverified: SubcontractorCompliance[]
}> {
  const all = await getCompliance(projectId)
  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  return {
    expired: all.filter(c => new Date(c.expiration_date) < now),
    expiring_soon: all.filter(c => {
      const exp = new Date(c.expiration_date)
      return exp >= now && exp < thirtyDays
    }),
    unverified: all.filter(c => !c.verified),
  }
}

export async function createCompliance(
  compliance: Omit<SubcontractorCompliance, 'id' | 'created_at' | 'updated_at'>
): Promise<SubcontractorCompliance | null> {
  const { data, error } = await supabase
    .from('subcontractor_compliance')
    .insert(compliance)
    .select()
    .single()

  if (error) {
    console.error('Error creating compliance record:', error)
    return null
  }
  return data as SubcontractorCompliance
}

export async function verifyCompliance(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('subcontractor_compliance')
    .update({ verified: true, updated_at: new Date().toISOString() })
    .eq('id', id)

  return !error
}
