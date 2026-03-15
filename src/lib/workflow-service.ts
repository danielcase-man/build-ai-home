/**
 * Workflow Service — orchestrates the guided workflow engine.
 *
 * Wraps the knowledge graph service with workflow-specific helpers
 * for phase tracking, status transitions, alerts, and decision recording.
 */

import { supabase } from './supabase'
import {
  getKnowledgeTree,
  getKnowledgeItems,
  getBlockers,
  getReadyItems,
  getDecisionPoints,
  getKnowledgeStateSummary,
  getProjectKnowledgeStates,
  updateKnowledgeState,
  initializeProjectKnowledgeStates,
} from './knowledge-graph'
import type {
  KnowledgeItem,
  KnowledgeTreeNode,
  ProjectKnowledgeState,
} from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowPhase {
  phase_number: number
  name: string
  status: 'not_started' | 'active' | 'completed' | 'on_hold'
  total_items: number
  completed_items: number
  blocked_items: number
  ready_items: number
  progress_percentage: number
}

export interface WorkflowAlert {
  type: 'blocker' | 'decision_needed' | 'ready_to_start' | 'phase_complete'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  message: string
  knowledge_id?: string
  phase_number?: number
}

export interface WorkflowOverview {
  phases: WorkflowPhase[]
  stats: {
    totalItems: number
    completed: number
    inProgress: number
    blocked: number
    ready: number
    pending: number
    decisionsPending: number
  }
  alerts: WorkflowAlert[]
}

// Phase names matching construction-phases.ts
const PHASE_NAMES: Record<number, string> = {
  1: 'Pre-Construction',
  2: 'Foundation',
  3: 'Framing & Structure',
  4: 'Rough-Ins (MEP)',
  5: 'Building Envelope',
  6: 'Interior Finishes',
  7: 'MEP Finishes',
  8: 'Exterior & Site',
}

// ---------------------------------------------------------------------------
// Read Operations
// ---------------------------------------------------------------------------

/** Get complete workflow overview: phases, stats, and alerts */
export async function getWorkflowOverview(projectId: string): Promise<WorkflowOverview> {
  const [items, states, stats] = await Promise.all([
    getKnowledgeItems(),
    getProjectKnowledgeStates(projectId),
    getKnowledgeStateSummary(projectId),
  ])

  const stateMap = new Map(states.map(s => [s.knowledge_id, s]))

  // Build phase summaries
  const phaseMap = new Map<number, { total: number; completed: number; blocked: number; ready: number; inProgress: number }>()
  for (let i = 1; i <= 8; i++) {
    phaseMap.set(i, { total: 0, completed: 0, blocked: 0, ready: 0, inProgress: 0 })
  }

  for (const item of items) {
    const phase = phaseMap.get(item.phase_number)
    if (!phase) continue
    phase.total++

    const state = stateMap.get(item.id)
    if (!state) continue
    switch (state.status) {
      case 'completed': phase.completed++; break
      case 'blocked': phase.blocked++; break
      case 'ready': phase.ready++; break
      case 'in_progress': phase.inProgress++; break
    }
  }

  const phases: WorkflowPhase[] = []
  for (let i = 1; i <= 8; i++) {
    const data = phaseMap.get(i)!
    let status: WorkflowPhase['status'] = 'not_started'
    if (data.completed === data.total && data.total > 0) {
      status = 'completed'
    } else if (data.completed > 0 || data.inProgress > 0 || data.ready > 0) {
      status = 'active'
    } else if (data.blocked > 0) {
      status = 'on_hold'
    }

    phases.push({
      phase_number: i,
      name: PHASE_NAMES[i] || `Phase ${i}`,
      status,
      total_items: data.total,
      completed_items: data.completed,
      blocked_items: data.blocked,
      ready_items: data.ready,
      progress_percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    })
  }

  // Generate alerts
  const alerts = await getWorkflowAlerts(projectId)

  return { phases, stats, alerts }
}

/** Get the active construction phase (first non-completed phase with activity) */
export async function getActivePhase(projectId: string): Promise<WorkflowPhase | null> {
  const overview = await getWorkflowOverview(projectId)
  return overview.phases.find(p => p.status === 'active') || overview.phases.find(p => p.status === 'not_started') || null
}

/** Get the checklist items for a specific phase with their status */
export async function getPhaseChecklist(
  projectId: string,
  phaseNumber: number
): Promise<KnowledgeTreeNode[]> {
  return getKnowledgeTree(projectId, { phase_number: phaseNumber })
}

/** Get upcoming decisions within a time horizon */
export async function getUpcomingDecisions(
  projectId: string,
  phaseNumber?: number
): Promise<Array<{ item: KnowledgeItem; state: ProjectKnowledgeState | null }>> {
  const decisions = await getDecisionPoints(projectId, phaseNumber)
  // Return only pending/ready decisions
  return decisions.filter(d => !d.state || d.state.status === 'pending' || d.state.status === 'ready')
}

/** Generate workflow alerts for blocked items, pending decisions, and ready items */
export async function getWorkflowAlerts(projectId: string): Promise<WorkflowAlert[]> {
  const [blockers, readyItems, decisions] = await Promise.all([
    getBlockers(projectId),
    getReadyItems(projectId),
    getDecisionPoints(projectId),
  ])

  const alerts: WorkflowAlert[] = []

  // Blocked items are high priority
  for (const blocker of blockers) {
    alerts.push({
      type: 'blocker',
      priority: 'high',
      title: `Blocked: ${blocker.item.item_name}`,
      message: `Waiting on: ${blocker.unmetDependencies.map(d => d.item_name).join(', ')}`,
      knowledge_id: blocker.item.id,
      phase_number: blocker.item.phase_number,
    })
  }

  // Pending decisions for active phases
  const pendingDecisions = decisions.filter(d =>
    !d.state || d.state.status === 'pending' || d.state.status === 'ready'
  )
  for (const decision of pendingDecisions) {
    alerts.push({
      type: 'decision_needed',
      priority: 'medium',
      title: `Decision needed: ${decision.item.item_name}`,
      message: decision.item.description || 'A decision is required to proceed.',
      knowledge_id: decision.item.id,
      phase_number: decision.item.phase_number,
    })
  }

  // Ready items (top 5 for brevity)
  for (const item of readyItems.slice(0, 5)) {
    alerts.push({
      type: 'ready_to_start',
      priority: 'low',
      title: `Ready: ${item.item_name}`,
      message: `${item.trade} — all prerequisites completed.${item.typical_duration_days ? ` Estimated ${item.typical_duration_days} days.` : ''}`,
      knowledge_id: item.id,
      phase_number: item.phase_number,
    })
  }

  // Sort: high priority first
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return alerts
}

// ---------------------------------------------------------------------------
// Write Operations
// ---------------------------------------------------------------------------

/** Start a workflow item (set status to in_progress) */
export async function startWorkflowItem(
  projectId: string,
  knowledgeId: string
): Promise<ProjectKnowledgeState | null> {
  return updateKnowledgeState(projectId, knowledgeId, { status: 'in_progress' })
}

/** Complete a workflow item with optional details */
export async function completeWorkflowItem(
  projectId: string,
  knowledgeId: string,
  data: { completedDate?: string; actualCost?: number; notes?: string } = {}
): Promise<ProjectKnowledgeState | null> {
  return updateKnowledgeState(projectId, knowledgeId, {
    status: 'completed',
    completed_date: data.completedDate || new Date().toISOString().split('T')[0],
    actual_cost: data.actualCost ?? null,
    notes: data.notes ?? null,
  })
}

/** Block a workflow item with a reason */
export async function blockWorkflowItem(
  projectId: string,
  knowledgeId: string,
  reason: string
): Promise<ProjectKnowledgeState | null> {
  return updateKnowledgeState(projectId, knowledgeId, {
    status: 'blocked',
    blocking_reason: reason,
  })
}

/** Record a decision for a decision point */
export async function recordDecision(
  projectId: string,
  knowledgeId: string,
  selectedOption: string,
  notes?: string
): Promise<ProjectKnowledgeState | null> {
  const noteText = `Decision: ${selectedOption}${notes ? ` — ${notes}` : ''}`
  return updateKnowledgeState(projectId, knowledgeId, {
    status: 'completed',
    completed_date: new Date().toISOString().split('T')[0],
    notes: noteText,
  })
}

/** Ensure project has knowledge states initialized */
export async function ensureWorkflowInitialized(projectId: string): Promise<number> {
  return initializeProjectKnowledgeStates(projectId)
}

// ---------------------------------------------------------------------------
// Workflow Phase Tracking (DB-backed)
// ---------------------------------------------------------------------------

/** Get or create workflow phase record */
export async function getWorkflowPhaseRecord(
  projectId: string,
  phaseNumber: number
): Promise<{ status: string; started_date: string | null; completed_date: string | null } | null> {
  const { data } = await supabase
    .from('workflow_phases')
    .select('status, started_date, completed_date')
    .eq('project_id', projectId)
    .eq('phase_number', phaseNumber)
    .single()

  return data
}

/** Update workflow phase status */
export async function updateWorkflowPhaseStatus(
  projectId: string,
  phaseNumber: number,
  status: 'not_started' | 'active' | 'completed' | 'on_hold'
): Promise<void> {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status,
    updated_at: now,
  }

  if (status === 'active') {
    updates.started_date = now.split('T')[0]
  } else if (status === 'completed') {
    updates.completed_date = now.split('T')[0]
  }

  await supabase
    .from('workflow_phases')
    .upsert({
      project_id: projectId,
      phase_number: phaseNumber,
      name: PHASE_NAMES[phaseNumber] || `Phase ${phaseNumber}`,
      ...updates,
    }, { onConflict: 'project_id,phase_number' })
}
