/**
 * Task-Email Reconciler — automatically updates task statuses from email evidence.
 *
 * This is the piece that was hidden inside the old AI status generator.
 * It matches pending "follow up with X" tasks against sent emails and
 * marks them as in-progress or completed when there's evidence the
 * action was taken.
 *
 * Also deduplicates tasks — the old AI kept creating new "follow up" tasks
 * every sync cycle without checking if one already existed.
 *
 * Runs as part of the orchestrator daily loop.
 */

import { supabase } from './supabase'

interface ReconciliationResult {
  tasksUpdated: number
  tasksDeduplicated: number
  details: Array<{ taskId: string; title: string; action: string; reason: string }>
}

// ---------------------------------------------------------------------------
// Contact extraction from task titles
// ---------------------------------------------------------------------------

/** Extract a person's name from a task title like "Follow up with Kim at Stone Systems..." */
function extractContactFromTitle(title: string): { name: string; company?: string } | null {
  // Pattern: "Follow up with [Name] at [Company]"
  const withAt = title.match(/follow\s+up\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:at|from)\s+([^—\-\(]+)/i)
  if (withAt) return { name: withAt[1].trim(), company: withAt[2].trim() }

  // Pattern: "Follow up with [Name] ([Company])"
  const withParen = title.match(/follow\s+up\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\(([^)]+)\)/i)
  if (withParen) return { name: withParen[1].trim(), company: withParen[2].trim() }

  // Pattern: "Follow up with [Name]"
  const justName = title.match(/follow\s+up\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
  if (justName) return { name: justName[1].trim() }

  // Pattern: "Request [Name] [verb]..."
  const request = title.match(/request\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s/i)
  if (request) return { name: request[1].trim() }

  // Pattern: "Contact [Name]"
  const contact = title.match(/contact\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
  if (contact) return { name: contact[1].trim() }

  return null
}

// ---------------------------------------------------------------------------
// Email matching
// ---------------------------------------------------------------------------

/** Check if there's a sent email to/from a contact after a given date */
async function findEmailEvidence(
  projectId: string,
  contactName: string,
  afterDate: string
): Promise<{ found: boolean; email?: { subject: string; date: string; direction: 'sent' | 'received' } }> {
  const nameLower = contactName.toLowerCase()

  // Check sent emails (Daniel contacted them)
  const { data: sentEmails } = await supabase
    .from('emails')
    .select('subject, received_date, sender_email')
    .eq('project_id', projectId)
    .gte('received_date', afterDate)
    .or(`sender_email.ilike.%danielcase%,sender_name.ilike.%daniel%case%`)
    .order('received_date', { ascending: false })
    .limit(50)

  if (sentEmails) {
    for (const e of sentEmails) {
      if (e.subject.toLowerCase().includes(nameLower)) {
        return { found: true, email: { subject: e.subject, date: e.received_date, direction: 'sent' } }
      }
    }
  }

  // Check received emails (they responded)
  const { data: receivedEmails } = await supabase
    .from('emails')
    .select('subject, received_date, sender_name, sender_email')
    .eq('project_id', projectId)
    .gte('received_date', afterDate)
    .order('received_date', { ascending: false })
    .limit(100)

  if (receivedEmails) {
    for (const e of receivedEmails) {
      const senderMatch = (e.sender_name || '').toLowerCase().includes(nameLower) ||
        (e.sender_email || '').toLowerCase().includes(nameLower.split(' ')[0])
      if (senderMatch) {
        return { found: true, email: { subject: e.subject, date: e.received_date, direction: 'received' } }
      }
    }
  }

  return { found: false }
}

// ---------------------------------------------------------------------------
// Task deduplication
// ---------------------------------------------------------------------------

/** Find and cancel duplicate tasks (same person + same action type) */
async function deduplicateTasks(projectId: string): Promise<{ cancelled: number; details: string[] }> {
  // Get all pending follow-up tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, created_at')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .ilike('title', '%follow up%')
    .order('created_at', { ascending: false })

  if (!tasks || tasks.length === 0) return { cancelled: 0, details: [] }

  // Group by extracted contact name
  const groups = new Map<string, typeof tasks>()
  for (const task of tasks) {
    const contact = extractContactFromTitle(task.title)
    if (!contact) continue
    const key = contact.name.toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(task)
  }

  let cancelled = 0
  const details: string[] = []

  // For each group with duplicates, keep newest, cancel rest
  for (const [name, groupTasks] of groups) {
    if (groupTasks.length <= 1) continue

    // Already sorted by created_at DESC — first is newest
    const toCancel = groupTasks.slice(1)
    const ids = toCancel.map(t => t.id)

    const { error } = await supabase
      .from('tasks')
      .update({ status: 'cancelled', notes: 'Deduplicated by task reconciler — superseded by newer task' })
      .in('id', ids)

    if (!error) {
      cancelled += ids.length
      details.push(`${name}: kept 1, cancelled ${ids.length} duplicates`)
    }
  }

  return { cancelled, details }
}

// ---------------------------------------------------------------------------
// Main Reconciler
// ---------------------------------------------------------------------------

/**
 * Reconcile tasks against email evidence.
 * For each pending "follow up with X" task:
 * - If Daniel sent an email mentioning X → mark in_progress
 * - If X responded via email → mark completed
 * - Also deduplicates repeat tasks
 */
export async function reconcileTasksFromEmails(projectId: string): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    tasksUpdated: 0,
    tasksDeduplicated: 0,
    details: [],
  }

  // Step 1: Deduplicate
  const dedup = await deduplicateTasks(projectId)
  result.tasksDeduplicated = dedup.cancelled
  for (const d of dedup.details) {
    result.details.push({ taskId: '', title: '', action: 'deduplicated', reason: d })
  }

  // Step 2: Get remaining pending follow-up tasks
  const { data: pendingTasks } = await supabase
    .from('tasks')
    .select('id, title, created_at, status')
    .eq('project_id', projectId)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })

  if (!pendingTasks) return result

  // Step 3: For each task with a contact reference, check for email evidence
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString()

  for (const task of pendingTasks) {
    const contact = extractContactFromTitle(task.title)
    if (!contact) continue

    const evidence = await findEmailEvidence(projectId, contact.name, twoWeeksAgo)
    if (!evidence.found) continue

    if (evidence.email?.direction === 'received') {
      // They responded → complete the task
      await supabase
        .from('tasks')
        .update({
          status: 'completed',
          notes: `Auto-completed: ${contact.name} responded via email "${evidence.email.subject}" on ${evidence.email.date}`,
        })
        .eq('id', task.id)

      result.tasksUpdated++
      result.details.push({
        taskId: task.id,
        title: task.title,
        action: 'completed',
        reason: `${contact.name} responded: "${evidence.email.subject}" (${evidence.email.date})`,
      })
    } else if (evidence.email?.direction === 'sent' && task.status === 'pending') {
      // Daniel sent follow-up → mark in-progress
      await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          notes: `Auto-updated: email sent "${evidence.email.subject}" on ${evidence.email.date}`,
        })
        .eq('id', task.id)

      result.tasksUpdated++
      result.details.push({
        taskId: task.id,
        title: task.title,
        action: 'in_progress',
        reason: `Email sent: "${evidence.email.subject}" (${evidence.email.date})`,
      })
    }
  }

  return result
}
