/**
 * Vendor Follow-Up Service — CRUD for tracking vendor outreach and follow-ups.
 *
 * Manages the lifecycle of vendor communications: initial outreach, follow-ups,
 * escalations, and completions. Integrates with bid packages to auto-create
 * follow-up records when vendors are contacted.
 */

import { supabase } from './supabase'
import type { VendorFollowUp, FollowUpStatus, FollowUpCategory } from '@/types'

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** Create a new follow-up record */
export async function createFollowUp(
  followUp: Omit<VendorFollowUp, 'id' | 'created_at' | 'updated_at'>
): Promise<VendorFollowUp | null> {
  const { data, error } = await supabase
    .from('vendor_follow_ups')
    .insert(followUp)
    .select()
    .single()

  if (error) {
    console.error('Error creating follow-up:', error)
    return null
  }
  return data as VendorFollowUp
}

/** Bulk-create follow-ups from a bid package outreach */
export async function createFollowUpsFromBidPackage(
  projectId: string,
  bidPackageId: string,
  vendors: Array<{ vendor_name: string; contact_email: string; deadline?: string }>
): Promise<VendorFollowUp[]> {
  const today = new Date().toISOString().slice(0, 10)
  const defaultDeadline = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  const records: Omit<VendorFollowUp, 'id' | 'created_at' | 'updated_at'>[] = vendors.map(v => ({
    project_id: projectId,
    vendor_name: v.vendor_name,
    contact_email: v.contact_email,
    category: 'bid_request' as FollowUpCategory,
    subject: `Bid request sent to ${v.vendor_name}`,
    related_bid_package_id: bidPackageId,
    created_date: today,
    initial_outreach_date: today,
    next_follow_up_date: v.deadline || defaultDeadline,
    deadline: v.deadline || defaultDeadline,
    status: 'sent' as FollowUpStatus,
    follow_up_count: 0,
    max_follow_ups: 3,
    auto_send: false,
    last_contact_date: today,
    last_contact_method: 'email',
  }))

  const { data, error } = await supabase
    .from('vendor_follow_ups')
    .insert(records)
    .select()

  if (error) {
    console.error('Error creating follow-ups from bid package:', error)
    return []
  }
  return (data || []) as VendorFollowUp[]
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Get follow-ups for a project with optional filters */
export async function getFollowUps(
  projectId: string,
  filters?: { status?: FollowUpStatus; category?: FollowUpCategory; vendorName?: string }
): Promise<VendorFollowUp[]> {
  let query = supabase
    .from('vendor_follow_ups')
    .select('*')
    .eq('project_id', projectId)
    .order('next_follow_up_date', { ascending: true })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.vendorName) query = query.eq('vendor_name', filters.vendorName)

  const { data, error } = await query
  if (error) return []
  return (data || []) as VendorFollowUp[]
}

/** Get overdue follow-ups (next_follow_up_date <= today and still awaiting) */
export async function getOverdueFollowUps(projectId: string): Promise<VendorFollowUp[]> {
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('vendor_follow_ups')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['sent', 'awaiting_response', 'follow_up_sent'])
    .lte('next_follow_up_date', today)
    .order('next_follow_up_date', { ascending: true })

  if (error) return []
  return (data || []) as VendorFollowUp[]
}

/** Get follow-ups coming due within the next N days */
export async function getUpcomingFollowUps(
  projectId: string,
  days: number
): Promise<VendorFollowUp[]> {
  const today = new Date().toISOString().slice(0, 10)
  const futureDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

  let query = supabase
    .from('vendor_follow_ups')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['sent', 'awaiting_response', 'follow_up_sent', 'pending'])
    .gte('next_follow_up_date', today)

  // lte is not in the chain mock so we add it via a filter pattern
  query = query.lte('next_follow_up_date', futureDate)
    .order('next_follow_up_date', { ascending: true })

  const { data, error } = await query
  if (error) return []
  return (data || []) as VendorFollowUp[]
}

/** Get follow-ups due today */
export async function getDueToday(projectId: string): Promise<VendorFollowUp[]> {
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('vendor_follow_ups')
    .select('*')
    .eq('project_id', projectId)
    .eq('next_follow_up_date', today)
    .in('status', ['sent', 'awaiting_response', 'follow_up_sent', 'pending'])
    .order('vendor_name', { ascending: true })

  if (error) return []
  return (data || []) as VendorFollowUp[]
}

/** Get aggregate stats by status */
export async function getFollowUpStats(
  projectId: string
): Promise<Record<FollowUpStatus, number>> {
  const { data, error } = await supabase
    .from('vendor_follow_ups')
    .select('status')
    .eq('project_id', projectId)

  const stats: Record<string, number> = {
    pending: 0,
    sent: 0,
    awaiting_response: 0,
    responded: 0,
    follow_up_sent: 0,
    escalated: 0,
    completed: 0,
    cancelled: 0,
    stale: 0,
  }

  if (error || !data) return stats as Record<FollowUpStatus, number>

  for (const row of data) {
    const s = (row as { status: string }).status
    if (s in stats) stats[s]++
  }

  return stats as Record<FollowUpStatus, number>
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/** Mark a follow-up as sent, increment count, set last contact */
export async function markFollowUpSent(
  id: string,
  method: string
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)

  // First get current follow_up_count
  const { data: current, error: fetchError } = await supabase
    .from('vendor_follow_ups')
    .select('follow_up_count, max_follow_ups')
    .eq('id', id)
    .single()

  if (fetchError || !current) return false

  const count = ((current as VendorFollowUp).follow_up_count || 0) + 1
  const newStatus: FollowUpStatus = count > 1 ? 'follow_up_sent' : 'sent'

  const { error } = await supabase
    .from('vendor_follow_ups')
    .update({
      status: newStatus,
      follow_up_count: count,
      last_contact_date: today,
      last_contact_method: method,
    })
    .eq('id', id)

  return !error
}

/** Mark a follow-up as responded with a summary */
export async function markFollowUpResponded(
  id: string,
  summary: string
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('vendor_follow_ups')
    .update({
      status: 'responded' as FollowUpStatus,
      response_summary: summary,
      last_contact_date: today,
    })
    .eq('id', id)

  return !error
}

/** Escalate a follow-up */
export async function escalateFollowUp(id: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('vendor_follow_ups')
    .update({
      status: 'escalated' as FollowUpStatus,
      escalation_date: today,
    })
    .eq('id', id)

  return !error
}

/** Complete a follow-up */
export async function completeFollowUp(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('vendor_follow_ups')
    .update({
      status: 'completed' as FollowUpStatus,
    })
    .eq('id', id)

  return !error
}
