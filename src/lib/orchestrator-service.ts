/**
 * Orchestrator Service — CRUD for orchestrator run records.
 *
 * Tracks each orchestrator run's actions, alerts, recommendations, and stats.
 * Provides audit trail for automated processing (email triage, follow-ups,
 * bid extraction, status updates).
 */

import { supabase } from './supabase'
import type { OrchestratorRun, OrchestratorAction, OrchestratorAlert } from '@/types'

// ---------------------------------------------------------------------------
// Run Lifecycle
// ---------------------------------------------------------------------------

/** Start a new orchestrator run */
export async function startOrchestratorRun(
  projectId: string
): Promise<OrchestratorRun | null> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('orchestrator_runs')
    .insert({
      project_id: projectId,
      run_date: now.slice(0, 10),
      started_at: now,
      status: 'running',
      actions_taken: [],
      alerts_generated: [],
      decisions_recommended: [],
      emails_processed: 0,
      follow_ups_sent: 0,
      bids_extracted: 0,
      statuses_updated: 0,
      errors: [],
    })
    .select()
    .single()

  if (error) {
    console.error('Error starting orchestrator run:', error)
    return null
  }
  return data as OrchestratorRun
}

/** Complete a run with final stats */
export async function completeOrchestratorRun(
  runId: string,
  stats: {
    emails_processed?: number
    follow_ups_sent?: number
    bids_extracted?: number
    statuses_updated?: number
    notes?: string
  }
): Promise<boolean> {
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('orchestrator_runs')
    .update({
      status: 'completed',
      completed_at: now,
      ...stats,
    })
    .eq('id', runId)

  return !error
}

/** Mark a run as failed */
export async function failOrchestratorRun(
  runId: string,
  errors: Array<{ message: string; context?: string }>
): Promise<boolean> {
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('orchestrator_runs')
    .update({
      status: 'failed',
      completed_at: now,
      errors,
    })
    .eq('id', runId)

  return !error
}

// ---------------------------------------------------------------------------
// Append Actions & Alerts
// ---------------------------------------------------------------------------

/** Append an action to the run's actions_taken array */
export async function logAction(
  runId: string,
  action: OrchestratorAction
): Promise<boolean> {
  // Fetch current actions
  const { data: run, error: fetchError } = await supabase
    .from('orchestrator_runs')
    .select('actions_taken')
    .eq('id', runId)
    .single()

  if (fetchError || !run) return false

  const actions = [...((run as OrchestratorRun).actions_taken || []), { ...action, timestamp: action.timestamp || new Date().toISOString() }]

  const { error } = await supabase
    .from('orchestrator_runs')
    .update({ actions_taken: actions })
    .eq('id', runId)

  return !error
}

/** Append an alert to the run's alerts_generated array */
export async function logAlert(
  runId: string,
  alert: OrchestratorAlert
): Promise<boolean> {
  // Fetch current alerts
  const { data: run, error: fetchError } = await supabase
    .from('orchestrator_runs')
    .select('alerts_generated')
    .eq('id', runId)
    .single()

  if (fetchError || !run) return false

  const alerts = [...((run as OrchestratorRun).alerts_generated || []), alert]

  const { error } = await supabase
    .from('orchestrator_runs')
    .update({ alerts_generated: alerts })
    .eq('id', runId)

  return !error
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Get recent orchestrator runs */
export async function getRecentRuns(
  projectId: string,
  days: number
): Promise<OrchestratorRun[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('orchestrator_runs')
    .select('*')
    .eq('project_id', projectId)
    .gte('run_date', since)
    .order('started_at', { ascending: false })

  if (error) return []
  return (data || []) as OrchestratorRun[]
}

/** Get the most recent run for a project */
export async function getLatestRun(
  projectId: string
): Promise<OrchestratorRun | null> {
  const { data, error } = await supabase
    .from('orchestrator_runs')
    .select('*')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data as OrchestratorRun
}
