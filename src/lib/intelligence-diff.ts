/**
 * Intelligence Diff Service
 *
 * Returns a summary of what the intelligence engine has found
 * since a given time (default: 24 hours ago). Used by the dashboard
 * to show "What's new" after intelligence runs.
 */

import { supabase } from './supabase'

export interface IntelligenceDiffItem {
  type: 'bid' | 'document' | 'contract' | 'invoice' | 'task' | 'follow_up'
  title: string
  detail?: string
  amount?: number
  created_at: string
}

export interface IntelligenceDiff {
  since: string
  bids_extracted: number
  documents_cataloged: number
  contracts_found: number
  invoices_created: number
  tasks_created: number
  follow_ups_tracked: number
  total_files_processed: number
  items: IntelligenceDiffItem[]
  last_run_at: string | null
  runs_since: number
}

/**
 * Get intelligence activity since a given timestamp.
 * Default: last 24 hours.
 */
export async function getIntelligenceDiff(
  projectId: string,
  since?: string,
): Promise<IntelligenceDiff> {
  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const items: IntelligenceDiffItem[] = []

  // Parallel queries for all recent activity
  const [
    recentBids,
    recentDocs,
    recentContracts,
    recentInvoices,
    recentTasks,
    recentFollowUps,
    recentRuns,
    filesProcessed,
  ] = await Promise.all([
    // New bids
    supabase
      .from('bids')
      .select('id, vendor_name, category, total_amount, created_at')
      .eq('project_id', projectId)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(50),

    // New documents cataloged
    supabase
      .from('documents')
      .select('id, name, category, created_at')
      .eq('project_id', projectId)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(50),

    // New contracts
    supabase
      .from('contracts')
      .select('id, title, total_amount, created_at')
      .eq('project_id', projectId)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(20),

    // New invoices
    supabase
      .from('invoices')
      .select('id, description, total_amount, created_at')
      .eq('project_id', projectId)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(20),

    // New tasks from intelligence engine
    supabase
      .from('tasks')
      .select('id, title, priority, created_at, notes')
      .eq('project_id', projectId)
      .gte('created_at', sinceDate)
      .like('notes', '%intelligence-engine%')
      .order('created_at', { ascending: false })
      .limit(20),

    // New/updated follow-ups
    supabase
      .from('vendor_follow_ups')
      .select('id, vendor_name, subject, created_at')
      .eq('project_id', projectId)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(20),

    // Intelligence runs
    supabase
      .from('intelligence_runs')
      .select('id, started_at, completed_at, changes_detected, agents_invoked')
      .gte('started_at', sinceDate)
      .not('completed_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(20),

    // Files processed
    supabase
      .from('file_inventory')
      .select('id')
      .eq('project_id', projectId)
      .eq('processing_status', 'completed')
      .gte('processed_at', sinceDate),
  ])

  // Build items list (most recent first, mixed)
  for (const bid of recentBids.data || []) {
    items.push({
      type: 'bid',
      title: `${bid.vendor_name} — ${bid.category}`,
      amount: bid.total_amount,
      created_at: bid.created_at,
    })
  }

  for (const doc of recentDocs.data || []) {
    items.push({
      type: 'document',
      title: doc.name,
      detail: doc.category,
      created_at: doc.created_at,
    })
  }

  for (const contract of recentContracts.data || []) {
    items.push({
      type: 'contract',
      title: contract.title,
      amount: contract.total_amount,
      created_at: contract.created_at,
    })
  }

  for (const invoice of recentInvoices.data || []) {
    items.push({
      type: 'invoice',
      title: invoice.description || 'Invoice',
      amount: invoice.total_amount,
      created_at: invoice.created_at,
    })
  }

  for (const task of recentTasks.data || []) {
    items.push({
      type: 'task',
      title: task.title,
      detail: task.priority,
      created_at: task.created_at,
    })
  }

  for (const fu of recentFollowUps.data || []) {
    items.push({
      type: 'follow_up',
      title: `${fu.vendor_name}: ${fu.subject}`,
      created_at: fu.created_at,
    })
  }

  // Sort all items by created_at descending
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const runs = recentRuns.data || []

  return {
    since: sinceDate,
    bids_extracted: recentBids.data?.length || 0,
    documents_cataloged: recentDocs.data?.length || 0,
    contracts_found: recentContracts.data?.length || 0,
    invoices_created: recentInvoices.data?.length || 0,
    tasks_created: recentTasks.data?.length || 0,
    follow_ups_tracked: recentFollowUps.data?.length || 0,
    total_files_processed: filesProcessed.data?.length || 0,
    items: items.slice(0, 20), // Top 20 most recent
    last_run_at: runs.length > 0 ? runs[0].completed_at : null,
    runs_since: runs.length,
  }
}
