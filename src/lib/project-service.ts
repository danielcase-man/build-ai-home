import { cache } from 'react'
import { supabase } from './supabase'
import { db } from './database'
import { generateProjectStatusFromData } from './project-status-generator'
import type { FullProjectContext } from './ai-summarization'
import { getBudgetItems } from './budget-service'
import { getBids } from './bids-service'
import { getSelections } from './selections-service'
import { getConstructionLoan } from './loan-service'
import { createActionItemNotification } from './notification-service'
import { getKnowledgeStateSummary } from './knowledge-graph'
import { getChangeOrders } from './change-order-service'
import { getDrawSummary } from './draw-schedule-service'
import { getExpiringWarranties, getComplianceGaps } from './warranty-service'
import { getPunchListStats } from './punch-list-service'
import type { ProjectStatusData, DashboardData, Question, KeyDataPoint } from '@/types'

/** Derive the current step number from planning_phase_steps rows. */
export function calculateCurrentStep(
  planningSteps: Array<{ step_number: number; status: string }> | null
): { currentStep: number; totalSteps: number } {
  const totalSteps = planningSteps?.length || 6
  const inProgressStep = planningSteps
    ?.filter(s => s.status === 'in_progress')
    .sort((a, b) => b.step_number - a.step_number)[0]
  const highestCompleted = planningSteps
    ?.filter(s => s.status === 'completed')
    .sort((a, b) => b.step_number - a.step_number)[0]
  const currentStep = inProgressStep?.step_number
    || (highestCompleted ? Math.min(highestCompleted.step_number + 1, totalSteps) : 1)
  return { currentStep, totalSteps }
}

export const getProject = cache(async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  // Silently return null for any error (RLS/auth failures, not-found, etc.)
  // since the caller already handles null gracefully
  if (error) {
    return null
  }

  return data
})

export async function getFullProjectContext(projectId: string): Promise<FullProjectContext | null> {
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) return null

  const [
    budgetItems,
    bids,
    selections,
    loan,
    { data: planningSteps },
    { data: milestones },
    { data: tasks },
    { data: permits },
    { data: contacts },
    { data: vendors },
    { data: communications },
  ] = await Promise.all([
    getBudgetItems(projectId),
    getBids(projectId),
    getSelections(projectId),
    getConstructionLoan(projectId),
    supabase
      .from('planning_phase_steps')
      .select('step_number, step_name, status, notes')
      .eq('project_id', projectId)
      .order('step_number', { ascending: true }),
    supabase
      .from('milestones')
      .select('name, description, target_date, completed_date, status, notes')
      .eq('project_id', projectId)
      .order('target_date', { ascending: true }),
    supabase
      .from('tasks')
      .select('title, description, due_date, priority, status, notes')
      .eq('project_id', projectId)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true })
      .limit(30),
    supabase
      .from('permits')
      .select('type, permit_number, status, application_date, approval_date, notes')
      .eq('project_id', projectId),
    supabase
      .from('contacts')
      .select('name, company, role, type')
      .eq('project_id', projectId),
    supabase
      .from('vendors')
      .select('company_name, category, status')
      .eq('project_id', projectId),
    supabase
      .from('communications')
      .select('date, type, subject, summary')
      .eq('project_id', projectId)
      .order('date', { ascending: false })
      .limit(20),
  ])

  const spent = budgetItems.reduce((sum, item) => sum + (item.actual_cost ?? 0), 0)
  const total = parseFloat(project.budget_total) || 450000

  const { currentStep, totalSteps } = calculateCurrentStep(planningSteps)

  return {
    project: {
      name: project.name || 'Unnamed Project',
      address: project.address || '',
      phase: project.phase || 'Planning',
      currentStep,
      totalSteps,
      startDate: project.created_at || '',
      targetCompletion: project.target_completion_date || '',
      squareFootage: project.square_footage ? parseFloat(project.square_footage) : null,
      style: project.style || '',
    },
    budget: {
      total,
      spent,
      remaining: total - spent,
      items: budgetItems,
    },
    planningSteps: (planningSteps || []).map(s => ({
      step_number: s.step_number,
      name: s.step_name || '',
      status: s.status || 'pending',
      notes: s.notes || null,
    })),
    milestones: (milestones || []).map(m => ({
      name: m.name,
      description: m.description || null,
      target_date: m.target_date || null,
      completed_date: m.completed_date || null,
      status: m.status || 'pending',
      notes: m.notes || null,
    })),
    tasks: (tasks || []).map(t => ({
      title: t.title,
      description: t.description || null,
      due_date: t.due_date || null,
      priority: t.priority || 'medium',
      status: t.status || 'pending',
      notes: t.notes || null,
    })),
    permits: (permits || []).map(p => ({
      type: p.type,
      permit_number: p.permit_number || null,
      status: p.status || 'pending',
      application_date: p.application_date || null,
      approval_date: p.approval_date || null,
      notes: p.notes || null,
    })),
    contacts: (contacts || []).map(c => ({
      name: c.name,
      company: c.company || null,
      role: c.role || null,
      type: c.type || null,
    })),
    vendors: (vendors || []).map(v => ({
      company_name: v.company_name,
      category: v.category || null,
      status: v.status || null,
    })),
    bids,
    selections,
    communications: (communications || []).map(c => ({
      date: c.date,
      type: c.type || null,
      subject: c.subject || null,
      summary: c.summary || null,
    })),
    loan,
    knowledgeState: await getKnowledgeStateSummary(projectId).catch(() => null),
    changeOrders: await getChangeOrders(projectId).then(orders =>
      orders.map(o => ({ title: o.title, reason: o.reason, status: o.status, cost_impact: o.cost_impact, schedule_impact_days: o.schedule_impact_days }))
    ).catch(() => []),
    drawSchedule: await getDrawSummary(projectId).then(s => ({
      total_draws: s.total_draws,
      funded_amount: s.funded_amount,
      pending_amount: s.pending_amount,
    })).catch(() => undefined),
    expiringWarranties: await getExpiringWarranties(projectId).then(ws =>
      ws.map(w => ({ vendor: w.vendor_name || 'Unknown', category: w.category, end_date: w.end_date }))
    ).catch(() => []),
    complianceGaps: await getComplianceGaps(projectId).then(g => ({
      expired: g.expired.length,
      expiring_soon: g.expiring_soon.length,
      unverified: g.unverified.length,
    })).catch(() => undefined),
    punchListStats: await getPunchListStats(projectId).then(s => ({
      total: s.total,
      completionRate: s.completionRate,
      bySeverity: s.bySeverity,
    })).catch(() => undefined),
  }
}

export async function getProjectDashboard(): Promise<DashboardData> {
  const project = await getProject()

  if (!project) {
    return getDefaultDashboard()
  }

  // Run all independent queries in parallel
  const [
    { data: planningSteps },
    { data: budgetItems },
    { count: unreadEmails },
    { count: pendingTasks },
    { data: nextMilestone },
  ] = await Promise.all([
    supabase
      .from('planning_phase_steps')
      .select('step_number, step_name, status')
      .eq('project_id', project.id)
      .order('step_number', { ascending: true }),
    supabase
      .from('budget_items')
      .select('estimated_cost, actual_cost')
      .eq('project_id', project.id),
    supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('is_read', false),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .in('status', ['pending', 'in_progress'])
      .not('due_date', 'is', null),
    supabase
      .from('milestones')
      .select('name, target_date')
      .eq('project_id', project.id)
      .in('status', ['pending', 'in_progress'])
      .order('target_date', { ascending: true })
      .limit(1),
  ])

  const { currentStep, totalSteps } = calculateCurrentStep(planningSteps)

  const budgetUsed = budgetItems?.reduce((sum, item) =>
    sum + (parseFloat(item.actual_cost) || 0), 0) || 0

  const createdAt = new Date(project.created_at)
  const daysElapsed = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  return {
    phase: project.phase || 'Planning',
    currentStep,
    totalSteps,
    daysElapsed,
    totalDays: project.estimated_duration_days || 117,
    budgetUsed,
    budgetTotal: parseFloat(project.budget_total) || 450000,
    unreadEmails: unreadEmails || 0,
    pendingTasks: pendingTasks || 0,
    upcomingMilestone: nextMilestone?.[0]?.name || '',
    milestoneDate: nextMilestone?.[0]?.target_date || '',
    planningSteps: (planningSteps || []).map(s => ({
      step_number: s.step_number,
      name: s.step_name || '',
      status: s.status || 'pending',
    })),
  }
}

export async function getProjectStatus(): Promise<ProjectStatusData | null> {
  const project = await getProject()

  if (!project) {
    return null
  }

  // Run all independent queries in parallel (removed duplicate project_status query)
  const [
    { data: statusRecord },
    { data: tasks },
    { data: emails },
    { data: budgetItems },
    { data: planningSteps },
    { data: nextMilestone },
  ] = await Promise.all([
    supabase
      .from('project_status')
      .select('*')
      .eq('project_id', project.id)
      .order('date', { ascending: false })
      .limit(1),
    supabase
      .from('tasks')
      .select('title, status')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('emails')
      .select('sender_name, ai_summary')
      .eq('project_id', project.id)
      .in('category', ['construction', 'legal', 'financial'])
      .order('received_date', { ascending: false })
      .limit(5),
    supabase
      .from('budget_items')
      .select('estimated_cost, actual_cost')
      .eq('project_id', project.id),
    supabase
      .from('planning_phase_steps')
      .select('step_number, step_name, status')
      .eq('project_id', project.id)
      .order('step_number', { ascending: true }),
    supabase
      .from('milestones')
      .select('name, target_date')
      .eq('project_id', project.id)
      .in('status', ['pending', 'in_progress'])
      .order('target_date', { ascending: true })
      .limit(1),
  ])

  const latestStatus = statusRecord?.[0]
  const hotTopics = (latestStatus?.hot_topics || []) as Array<{ priority: string; text: string }>
  const recentDecisions = (latestStatus?.recent_decisions || []) as Array<{ decision: string; impact: string }>

  // Prefer AI-derived action items (richer: have action_type, action_context)
  // Fall back to tasks table if no AI status exists yet
  const rawAIActions = latestStatus?.action_items as Array<{
    status: string; text: string;
    action_type?: 'draft_email' | null;
    action_context?: { to?: string; to_name?: string; subject_hint?: string; context?: string }
  }> | undefined
  const actionItems = (rawAIActions && rawAIActions.length > 0)
    ? rawAIActions
    : (tasks || []).map(t => ({
        status: t.status === 'completed' ? 'completed' : t.status === 'in_progress' ? 'in-progress' : 'pending',
        text: t.title
      }))

  const recentCommunications = (emails || []).map(e => ({
    from: e.sender_name || 'Unknown',
    summary: e.ai_summary || 'No summary available'
  }))

  const budgetUsed = budgetItems?.reduce((sum, item) =>
    sum + (parseFloat(item.actual_cost) || 0), 0) || 0

  const { currentStep: stepNum, totalSteps: stepsTotal } = calculateCurrentStep(planningSteps)
  const createdAt = new Date(project.created_at)
  const daysElapsed = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
  const totalDays = project.estimated_duration_days || 117

  return {
    date: new Date(),
    phase: project.phase || 'Planning',
    currentStep: getStepName(stepNum),
    stepNumber: stepNum,
    totalSteps: stepsTotal,
    progressPercentage: Math.round((stepNum / stepsTotal) * 100),
    daysElapsed,
    totalDays,
    budgetStatus: budgetUsed <= parseFloat(project.budget_total) ? 'On Track' : 'Over Budget',
    budgetUsed,
    budgetTotal: parseFloat(project.budget_total) || 450000,
    contingencyRemaining: Math.max(0, (parseFloat(project.budget_total) || 450000) * 0.05 - Math.max(0, budgetUsed - (parseFloat(project.budget_total) || 450000) * 0.95)),
    nextMilestone: nextMilestone?.[0]?.name || 'TBD',
    milestoneDate: nextMilestone?.[0]?.target_date || 'TBD',
    hotTopics,
    actionItems,
    recentCommunications,
    recentDecisions,
    nextSteps: (latestStatus?.next_steps || []) as string[],
    openQuestions: (latestStatus?.open_questions || []) as Question[],
    keyDataPoints: (latestStatus?.key_data_points || []) as KeyDataPoint[],
    aiSummary: latestStatus?.ai_summary || 'No AI summary available yet. Connect Gmail and sync emails to generate project insights.'
  }
}

function getStepName(stepNumber: number): string {
  const steps = [
    'Consultation',
    'Lot Analysis',
    'Plans Selection',
    'Specifications',
    'Cost Review',
    'Final Approval'
  ]
  return steps[stepNumber - 1] || `Step ${stepNumber}`
}

function getDefaultDashboard(): DashboardData {
  return {
    phase: 'Planning',
    currentStep: 1,
    totalSteps: 6,
    daysElapsed: 0,
    totalDays: 117,
    budgetUsed: 0,
    budgetTotal: 450000,
    unreadEmails: 0,
    pendingTasks: 0,
    upcomingMilestone: '',
    milestoneDate: '',
    planningSteps: [],
  }
}

export async function updateProjectStatus(projectId: string): Promise<void> {
  // Fetch full project context for AI grounding
  const fullContext = await getFullProjectContext(projectId)

  if (!fullContext) {
    console.error('updateProjectStatus: project not found', projectId)
    return
  }

  // Generate status snapshot from structured data (no AI calls)
  const snapshot = generateProjectStatusFromData(fullContext)

  const { currentStep, totalSteps } = { currentStep: fullContext.project.currentStep, totalSteps: fullContext.project.totalSteps }
  const budgetUsed = fullContext.budget.spent
  const budgetTotal = fullContext.budget.total

  // Write to database
  await db.upsertProjectStatus(projectId, {
    phase: fullContext.project.phase,
    current_step: currentStep,
    progress_percentage: Math.round((currentStep / totalSteps) * 100),
    hot_topics: snapshot.hot_topics,
    action_items: snapshot.action_items,
    recent_decisions: snapshot.recent_decisions,
    next_steps: snapshot.next_steps,
    open_questions: snapshot.open_questions,
    key_data_points: snapshot.key_data_points,
    budget_status: budgetUsed <= budgetTotal ? 'On Track' : 'Over Budget',
    budget_used: budgetUsed,
    ai_summary: snapshot.ai_summary
  })

  // Cascade AI action items into the tasks table
  await db.syncAIInsightsToTasks(projectId, snapshot.action_items)

  // Notify for new high-priority action items
  for (const item of snapshot.action_items) {
    if (item.action_type === 'draft_email' && item.status !== 'completed') {
      await createActionItemNotification(projectId, item.text)
    }
  }

  console.log(`Project status updated for project ${projectId}`)
}

export async function getActiveHotTopics(projectId: string): Promise<string[]> {
  const { data } = await supabase
    .from('project_status')
    .select('hot_topics')
    .eq('project_id', projectId)
    .order('date', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return []

  const topics = data[0].hot_topics
  if (Array.isArray(topics)) {
    return topics.map((t: { text?: string } | string) =>
      typeof t === 'string' ? t : t.text || ''
    ).filter(Boolean)
  }

  return []
}

export async function getRecentCommunications(projectId: string, limit = 5) {
  const { data } = await supabase
    .from('emails')
    .select('sender_name, sender_email, subject, ai_summary, received_date')
    .eq('project_id', projectId)
    .order('received_date', { ascending: false })
    .limit(limit)

  return data || []
}

export async function getBudgetSummary(projectId: string) {
  const { data } = await supabase
    .from('budget_items')
    .select('category, estimated_cost, actual_cost, status')
    .eq('project_id', projectId)

  if (!data) return { total: 0, spent: 0, categories: [] }

  const total = data.reduce((sum, item) => sum + (parseFloat(item.estimated_cost) || 0), 0)
  const spent = data.reduce((sum, item) => sum + (parseFloat(item.actual_cost) || 0), 0)

  return { total, spent, categories: data }
}
