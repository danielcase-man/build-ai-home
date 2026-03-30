/**
 * Incremental Intelligence Engine
 *
 * Central coordinator for the FrameWork intelligence system.
 * Checks all data sources for changes, routes to domain agents,
 * and keeps the dashboard always current.
 *
 * Flow: Check watermarks → Scan sources → Detect changes →
 *       Route to agents → Update Supabase → Log run
 */

import { supabase } from './supabase'
import { getProject } from './project-service'
import { getAllWatermarks, shouldProcess, updateWatermark } from './source-watermarks'
import { scanDropboxIncremental, getPendingFiles } from './dropbox-watcher'
import { dispatchToAgents, getRegisteredDomains } from './agent-router'
import { generateProjectStatusFromData } from './project-status-generator'
import { getFullProjectContext } from './project-service'
import type {
  IntelligenceRunResult,
  IntelligenceSource,
  ChangeEvent,
  AgentResult,
} from '@/types'

// Import agents to trigger registration
import './bid-analysis-agent'
import './takeoff-agent'
import './financial-agent'
import './contract-agent'
import './scheduling-agent'
import './follow-up-agent'

// Minimum interval between source checks (minutes)
const SOURCE_INTERVALS: Record<IntelligenceSource, number> = {
  dropbox: 15,    // Check Dropbox every 15 minutes
  gmail: 30,      // Gmail has its own sync — check less frequently
  jobtread: 60,   // JobTread syncs via its own cron
  manual: 0,      // Always process manual triggers
}

/**
 * Run the intelligence engine.
 * This is the main entry point — called by the API endpoint and cron.
 *
 * @param options.sources - Specific sources to check (default: all)
 * @param options.force - Ignore watermark intervals
 * @param options.processBacklog - Process pending files from previous scans
 * @param options.triggerType - What triggered this run
 */
export async function runIntelligenceEngine(options: {
  sources?: IntelligenceSource[]
  force?: boolean
  processBacklog?: boolean
  triggerType?: 'cron' | 'manual' | 'webhook'
} = {}): Promise<IntelligenceRunResult> {
  const startTime = Date.now()
  const startedAt = new Date().toISOString()
  const sourcesToCheck = options.sources || (['dropbox', 'gmail', 'jobtread'] as IntelligenceSource[])
  const allChanges: ChangeEvent[] = []
  const allResults: AgentResult[] = []
  const errors: string[] = []

  // Create run record
  const { data: runRecord } = await supabase
    .from('intelligence_runs')
    .insert({
      started_at: startedAt,
      status: 'running',
      sources_checked: sourcesToCheck,
      trigger_type: options.triggerType || 'manual',
    })
    .select('id')
    .single()

  const runId = runRecord?.id

  const project = await getProject()
  if (!project) {
    const result: IntelligenceRunResult = {
      run_id: runId,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      sources_checked: [],
      changes_detected: 0,
      agents_invoked: [],
      results: [],
      errors: ['No project found'],
      duration_ms: Date.now() - startTime,
    }
    if (runId) await completeRun(runId, result)
    return result
  }

  const projectId = project.id

  // Get current watermarks
  const watermarks = await getAllWatermarks()
  const watermarkMap = new Map(watermarks.map(w => [w.source, w]))

  // ═══════════════════════════════════════════════════════════
  // Phase 1: Scan sources for changes
  // ═══════════════════════════════════════════════════════════

  for (const source of sourcesToCheck) {
    const watermark = watermarkMap.get(source) || null
    const interval = SOURCE_INTERVALS[source]

    if (!options.force && !shouldProcess(watermark, interval)) {
      continue // Not time to check this source yet
    }

    try {
      switch (source) {
        case 'dropbox': {
          console.log('[intelligence] Scanning Dropbox for changes...')
          const scan = await scanDropboxIncremental(projectId)
          allChanges.push(...scan.newFiles, ...scan.modifiedFiles)
          if (scan.errors.length > 0) errors.push(...scan.errors)
          console.log(`[intelligence] Dropbox: ${scan.newFiles.length} new, ${scan.modifiedFiles.length} modified of ${scan.totalScanned} total`)
          break
        }

        case 'gmail': {
          // Gmail sync is handled by sync-emails cron. We just check
          // for unprocessed emails that need domain routing.
          console.log('[intelligence] Checking for unprocessed emails...')
          const { data: recentEmails } = await supabase
            .from('emails')
            .select('id, subject, sender_email, received_date')
            .eq('project_id', projectId)
            .gt('received_date', watermark?.last_processed_at || '2020-01-01')
            .order('received_date', { ascending: true })
            .limit(50)

          if (recentEmails && recentEmails.length > 0) {
            const { classifyEmail } = await import('./agent-router')
            for (const email of recentEmails) {
              const domain = classifyEmail(email.subject, email.sender_email)
              if (domain !== 'general') {
                allChanges.push({
                  source: 'gmail',
                  domain,
                  email_id: email.id,
                  detected_at: new Date().toISOString(),
                  metadata: { subject: email.subject, sender: email.sender_email },
                })
              }
            }

            await updateWatermark('gmail', {
              last_processed_at: recentEmails[recentEmails.length - 1].received_date,
              items_processed: recentEmails.length,
            })
          }
          console.log(`[intelligence] Gmail: ${allChanges.filter(c => c.source === 'gmail').length} domain-relevant emails`)
          break
        }

        case 'jobtread': {
          // JobTread sync is handled by its own cron. Just update watermark.
          await updateWatermark('jobtread', {
            last_processed_at: new Date().toISOString(),
          })
          break
        }
      }
    } catch (err) {
      const msg = `Source scan failed for ${source}: ${err instanceof Error ? err.message : 'Unknown'}`
      errors.push(msg)
      console.error(`[intelligence] ${msg}`)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 1b: Include backlog (pending files from previous scans)
  // ═══════════════════════════════════════════════════════════

  if (options.processBacklog) {
    // Only process backlog for domains that have registered agent handlers
    const registeredDomains = getRegisteredDomains()
    for (const domain of registeredDomains) {
      const pending = await getPendingFiles(projectId, domain, 20)
      for (const file of pending) {
        const alreadyQueued = allChanges.some(c => c.file_path === file.file_path)
        if (!alreadyQueued) {
          allChanges.push({
            source: 'dropbox',
            domain: (file.agent_domain as ChangeEvent['domain']) || domain,
            file_path: file.file_path,
            file_name: file.file_name,
            file_type: file.file_type,
            detected_at: new Date().toISOString(),
          })
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 2: Route changes to domain agents
  // ═══════════════════════════════════════════════════════════

  if (allChanges.length > 0) {
    console.log(`[intelligence] Routing ${allChanges.length} changes to domain agents...`)
    const agentResults = await dispatchToAgents(allChanges, projectId)
    allResults.push(...agentResults)

    for (const r of agentResults) {
      if (r.errors.length > 0) errors.push(...r.errors)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 3: Update project status (always, if agents ran)
  // ═══════════════════════════════════════════════════════════

  const shouldUpdateStatus = options.force ||
    allResults.some(r => r.records_created > 0 || r.records_updated > 0)

  if (shouldUpdateStatus) {
    try {
      console.log('[intelligence] Updating project status snapshot...')
      const fullContext = await getFullProjectContext(projectId)
      if (fullContext) {
        const snapshot = generateProjectStatusFromData(fullContext)
        const { db } = await import('./database')
        await db.upsertProjectStatus(projectId, {
          phase: fullContext.project.phase,
          current_step: fullContext.project.currentStep,
          progress_percentage: Math.round((fullContext.project.currentStep / fullContext.project.totalSteps) * 100),
          hot_topics: snapshot.hot_topics,
          action_items: snapshot.action_items,
          recent_decisions: snapshot.recent_decisions,
          next_steps: snapshot.next_steps,
          open_questions: snapshot.open_questions,
          key_data_points: snapshot.key_data_points,
          budget_status: fullContext.budget.spent <= fullContext.budget.total ? 'On Track' : 'Over Budget',
          budget_used: fullContext.budget.spent,
          ai_summary: snapshot.ai_summary,
        })
        console.log('[intelligence] Status snapshot updated')
      }
    } catch (err) {
      errors.push(`Status update failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Complete
  // ═══════════════════════════════════════════════════════════

  const agentsInvoked = [...new Set(allResults.map(r => r.domain))]
  const completedAt = new Date().toISOString()

  const runResult: IntelligenceRunResult = {
    run_id: runId,
    started_at: startedAt,
    completed_at: completedAt,
    sources_checked: sourcesToCheck,
    changes_detected: allChanges.length,
    agents_invoked: agentsInvoked,
    results: allResults,
    errors,
    duration_ms: Date.now() - startTime,
  }

  if (runId) await completeRun(runId, runResult)

  console.log(`[intelligence] Run complete: ${allChanges.length} changes, ${agentsInvoked.length} agents, ${errors.length} errors, ${Date.now() - startTime}ms`)

  return runResult
}

async function completeRun(runId: string, result: IntelligenceRunResult): Promise<void> {
  await supabase
    .from('intelligence_runs')
    .update({
      completed_at: result.completed_at,
      status: result.errors.length > 0 ? 'partial' : 'completed',
      changes_detected: result.changes_detected,
      agents_invoked: result.agents_invoked,
      results: result.results,
      errors: result.errors,
      duration_ms: result.duration_ms,
    })
    .eq('id', runId)
}

/**
 * Get the most recent intelligence run result.
 */
export async function getLatestRun(): Promise<IntelligenceRunResult | null> {
  const { data } = await supabase
    .from('intelligence_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return null

  return {
    run_id: data.id,
    started_at: data.started_at,
    completed_at: data.completed_at,
    sources_checked: data.sources_checked,
    changes_detected: data.changes_detected,
    agents_invoked: data.agents_invoked,
    results: data.results,
    errors: data.errors,
    duration_ms: data.duration_ms,
  }
}
