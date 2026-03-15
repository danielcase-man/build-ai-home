/**
 * Vendor Thread Service — unified vendor conversation tracking.
 *
 * Groups emails by vendor, tracks bid request/response timelines,
 * identifies follow-ups needed, and provides a unified thread view.
 * Designed to interlock with Plaid integration (contracts/invoices/payments).
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VendorThread {
  id?: string
  project_id: string
  vendor_id: string | null
  contact_id: string | null
  vendor_name: string
  vendor_email: string | null
  category: string | null
  status: 'active' | 'waiting_response' | 'follow_up_needed' | 'closed'
  last_activity: string | null
  days_since_contact: number
  follow_up_date: string | null
  bid_requested_date: string | null
  bid_received_date: string | null
  contract_id: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface ThreadTimelineEntry {
  date: string
  type: 'email_sent' | 'email_received' | 'bid_requested' | 'bid_received' | 'note' | 'status_change'
  subject: string | null
  summary: string | null
  email_id: string | null
  direction: 'inbound' | 'outbound' | null
}

export interface FollowUpNeeded {
  thread: VendorThread
  days_waiting: number
  reason: string
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/** Get all vendor threads for a project */
export async function getVendorThreads(
  projectId: string,
  filters?: { status?: string; category?: string }
): Promise<VendorThread[]> {
  let query = supabase
    .from('vendor_threads')
    .select('*')
    .eq('project_id', projectId)
    .order('last_activity', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.category) query = query.eq('category', filters.category)

  const { data, error } = await query
  if (error) return []

  // Calculate days_since_contact for each thread
  return (data || []).map(t => ({
    ...t,
    days_since_contact: t.last_activity
      ? Math.floor((Date.now() - new Date(t.last_activity).getTime()) / (1000 * 60 * 60 * 24))
      : 999,
  })) as VendorThread[]
}

/** Get a single thread with full timeline */
export async function getThreadTimeline(
  threadId: string
): Promise<{ thread: VendorThread | null; timeline: ThreadTimelineEntry[] }> {
  // Get thread
  const { data: thread, error } = await supabase
    .from('vendor_threads')
    .select('*')
    .eq('id', threadId)
    .single()

  if (error || !thread) return { thread: null, timeline: [] }

  const timeline: ThreadTimelineEntry[] = []

  // Get emails matching this vendor's email address
  if (thread.vendor_email) {
    const { data: emails } = await supabase
      .from('emails')
      .select('id, sender_email, subject, ai_summary, received_date')
      .or(`sender_email.eq.${thread.vendor_email},recipients.cs.{"to":["${thread.vendor_email}"]}`)
      .eq('project_id', thread.project_id)
      .order('received_date', { ascending: true })

    if (emails) {
      for (const email of emails) {
        timeline.push({
          date: email.received_date,
          type: email.sender_email === thread.vendor_email ? 'email_received' : 'email_sent',
          subject: email.subject,
          summary: email.ai_summary,
          email_id: email.id,
          direction: email.sender_email === thread.vendor_email ? 'inbound' : 'outbound',
        })
      }
    }
  }

  // Get communications logged for this vendor/contact
  if (thread.contact_id) {
    const { data: comms } = await supabase
      .from('communications')
      .select('date, type, subject, summary')
      .eq('project_id', thread.project_id)
      .eq('contact_id', thread.contact_id)
      .order('date', { ascending: true })

    if (comms) {
      for (const comm of comms) {
        timeline.push({
          date: comm.date,
          type: 'note',
          subject: comm.subject,
          summary: comm.summary,
          email_id: null,
          direction: null,
        })
      }
    }
  }

  // Add bid events
  if (thread.bid_requested_date) {
    timeline.push({
      date: thread.bid_requested_date,
      type: 'bid_requested',
      subject: `Bid requested: ${thread.category || 'General'}`,
      summary: null,
      email_id: null,
      direction: 'outbound',
    })
  }
  if (thread.bid_received_date) {
    timeline.push({
      date: thread.bid_received_date,
      type: 'bid_received',
      subject: `Bid received: ${thread.category || 'General'}`,
      summary: null,
      email_id: null,
      direction: 'inbound',
    })
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const vendorThread: VendorThread = {
    ...thread,
    days_since_contact: thread.last_activity
      ? Math.floor((Date.now() - new Date(thread.last_activity).getTime()) / (1000 * 60 * 60 * 24))
      : 999,
  }

  return { thread: vendorThread, timeline }
}

/** Get threads that need follow-up (configurable threshold in days) */
export async function getFollowUpsNeeded(
  projectId: string,
  thresholdDays = 5
): Promise<FollowUpNeeded[]> {
  const threads = await getVendorThreads(projectId)
  const followUps: FollowUpNeeded[] = []

  for (const thread of threads) {
    if (thread.status === 'closed') continue

    // Check explicit follow_up_date
    if (thread.follow_up_date) {
      const followUpDate = new Date(thread.follow_up_date)
      if (followUpDate <= new Date()) {
        followUps.push({
          thread,
          days_waiting: thread.days_since_contact,
          reason: `Follow-up date passed (${thread.follow_up_date})`,
        })
        continue
      }
    }

    // Check waiting_response status
    if (thread.status === 'waiting_response' && thread.days_since_contact >= thresholdDays) {
      followUps.push({
        thread,
        days_waiting: thread.days_since_contact,
        reason: `Waiting ${thread.days_since_contact} days for response`,
      })
      continue
    }

    // Check bid requested but not received
    if (thread.bid_requested_date && !thread.bid_received_date) {
      const daysSinceBidRequest = Math.floor(
        (Date.now() - new Date(thread.bid_requested_date).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceBidRequest >= thresholdDays) {
        followUps.push({
          thread,
          days_waiting: daysSinceBidRequest,
          reason: `Bid requested ${daysSinceBidRequest} days ago, not yet received`,
        })
      }
    }
  }

  // Sort by days waiting (most overdue first)
  followUps.sort((a, b) => b.days_waiting - a.days_waiting)
  return followUps
}

/** Auto-link emails to vendor threads by sender domain */
export async function autoLinkEmails(projectId: string): Promise<{ linked: number; created: number }> {
  // Get all vendor threads with email addresses
  const threads = await getVendorThreads(projectId)
  const threadsByEmail = new Map<string, VendorThread>()
  for (const thread of threads) {
    if (thread.vendor_email) {
      threadsByEmail.set(thread.vendor_email.toLowerCase(), thread)
    }
  }

  // Get contacts with vendor type
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, email, company, type')
    .eq('project_id', projectId)
    .in('type', ['vendor', 'contractor', 'supplier'])

  let created = 0

  // Create threads for vendors that don't have one yet
  if (contacts) {
    for (const contact of contacts) {
      if (!contact.email) continue
      if (threadsByEmail.has(contact.email.toLowerCase())) continue

      const { data: newThread } = await supabase
        .from('vendor_threads')
        .insert({
          project_id: projectId,
          vendor_id: null,
          contact_id: contact.id,
          vendor_name: contact.company || contact.name,
          vendor_email: contact.email,
          category: null,
          status: 'active',
          last_activity: new Date().toISOString(),
        })
        .select()
        .single()

      if (newThread) {
        threadsByEmail.set(contact.email.toLowerCase(), newThread as VendorThread)
        created++
      }
    }
  }

  // Now update last_activity for threads based on most recent email
  let linked = 0
  for (const [email, thread] of threadsByEmail) {
    const { data: latestEmail } = await supabase
      .from('emails')
      .select('received_date')
      .or(`sender_email.eq.${email}`)
      .eq('project_id', projectId)
      .order('received_date', { ascending: false })
      .limit(1)
      .single()

    if (latestEmail && latestEmail.received_date) {
      const currentActivity = thread.last_activity ? new Date(thread.last_activity) : new Date(0)
      const emailDate = new Date(latestEmail.received_date)

      if (emailDate > currentActivity) {
        await supabase
          .from('vendor_threads')
          .update({
            last_activity: latestEmail.received_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', thread.id)
        linked++
      }
    }
  }

  return { linked, created }
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/** Create a new vendor thread */
export async function createVendorThread(
  thread: Omit<VendorThread, 'id' | 'days_since_contact' | 'created_at' | 'updated_at'>
): Promise<VendorThread | null> {
  const { data, error } = await supabase
    .from('vendor_threads')
    .insert({
      project_id: thread.project_id,
      vendor_id: thread.vendor_id,
      contact_id: thread.contact_id,
      vendor_name: thread.vendor_name,
      vendor_email: thread.vendor_email,
      category: thread.category,
      status: thread.status || 'active',
      last_activity: thread.last_activity || new Date().toISOString(),
      follow_up_date: thread.follow_up_date,
      bid_requested_date: thread.bid_requested_date,
      bid_received_date: thread.bid_received_date,
      contract_id: thread.contract_id,
      notes: thread.notes,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating vendor thread:', error)
    return null
  }

  return { ...(data as VendorThread), days_since_contact: 0 }
}

/** Update a vendor thread */
export async function updateVendorThread(
  threadId: string,
  updates: Partial<Pick<VendorThread, 'status' | 'follow_up_date' | 'bid_requested_date' | 'bid_received_date' | 'contract_id' | 'notes' | 'category'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('vendor_threads')
    .update({
      ...updates,
      last_activity: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)

  if (error) {
    console.error('Error updating vendor thread:', error)
    return false
  }
  return true
}

/** Mark a vendor thread as having received a bid */
export async function markBidReceived(
  threadId: string,
  receivedDate?: string
): Promise<boolean> {
  return updateVendorThread(threadId, {
    bid_received_date: receivedDate || new Date().toISOString().split('T')[0],
    status: 'active',
  })
}
