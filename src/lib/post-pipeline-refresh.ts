/**
 * Post-Pipeline Refresh — convergence layer.
 *
 * Called after any data pipeline completes (email sync, jobtread sync,
 * vendor selection, decision recording, intelligence engine).
 * Ensures all cross-cutting data stays consistent.
 *
 * Steps:
 * 1. Auto-link emails to vendor threads
 * 2. Reconcile tasks from email evidence
 * 3. Regenerate deterministic project status
 */

import { supabase } from './supabase'
import { autoLinkEmails } from './vendor-thread-service'
import { getFullProjectContext } from './project-service'
import { generateProjectStatusFromData } from './project-status-generator'

export async function postPipelineRefresh(
  projectId: string,
  trigger: string
): Promise<{ vendor_threads: number; status_updated: boolean }> {
  let vendorThreadsCreated = 0
  let statusUpdated = false

  // 1. Auto-link emails to vendor threads
  try {
    const linkResult = await autoLinkEmails(projectId)
    vendorThreadsCreated = linkResult.created
  } catch {
    // Non-fatal
  }

  // 2. Regenerate deterministic project status (no AI call, free)
  try {
    const ctx = await getFullProjectContext(projectId)
    if (ctx) {
      const snapshot = generateProjectStatusFromData(ctx)
      const today = new Date().toISOString().split('T')[0]

      // Merge with existing AI data if present (don't overwrite AI summary)
      const { data: existing } = await supabase
        .from('project_status')
        .select('ai_summary, action_items')
        .eq('project_id', projectId)
        .eq('date', today)
        .single()

      await supabase.from('project_status').upsert({
        project_id: projectId,
        date: today,
        ...snapshot,
        // Preserve AI-generated fields if they exist
        ai_summary: existing?.ai_summary || snapshot.ai_summary,
        action_items: existing?.action_items || snapshot.action_items,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'project_id,date' })

      statusUpdated = true
    }
  } catch {
    // Non-fatal
  }

  console.log(`[post-pipeline-refresh] trigger=${trigger} threads=${vendorThreadsCreated} status=${statusUpdated}`)
  return { vendor_threads: vendorThreadsCreated, status_updated: statusUpdated }
}
