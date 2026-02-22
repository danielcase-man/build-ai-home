import { cache } from 'react'
import { supabase } from './supabase'
import { db } from './database'
import { generateProjectStatusSnapshot } from './ai-summarization'
import type { ProjectStatusData, DashboardData, Email } from '@/types'

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

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching project:', error)
  }

  return data
})

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
      .select('step_number, name, status')
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
      .in('status', ['pending', 'in_progress']),
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
      name: s.name || '',
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
      .order('received_date', { ascending: false })
      .limit(5),
    supabase
      .from('budget_items')
      .select('estimated_cost, actual_cost')
      .eq('project_id', project.id),
    supabase
      .from('planning_phase_steps')
      .select('step_number, name, status')
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

  const actionItems = (tasks || []).map(t => ({
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
  // Fetch project data
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) {
    console.error('updateProjectStatus: project not found', projectId)
    return
  }

  // Fetch planning steps for progress calculation
  const { data: planningSteps } = await supabase
    .from('planning_phase_steps')
    .select('step_number, status')
    .eq('project_id', projectId)
    .order('step_number', { ascending: true })

  const { currentStep, totalSteps } = calculateCurrentStep(planningSteps)

  const budgetItems = await supabase
    .from('budget_items')
    .select('actual_cost')
    .eq('project_id', projectId)

  const budgetUsed = budgetItems.data?.reduce((sum, item) =>
    sum + (parseFloat(item.actual_cost) || 0), 0) || 0
  const budgetTotal = parseFloat(project.budget_total) || 450000

  // Fetch previous status report for iterative context
  const previousStatus = await db.getLatestProjectStatus(projectId)

  // Normalize legacy string formats in previous status
  if (previousStatus) {
    if (typeof previousStatus.hot_topics === 'string') {
      try { previousStatus.hot_topics = JSON.parse(previousStatus.hot_topics as string) } catch { previousStatus.hot_topics = [] }
    }
    if (typeof previousStatus.action_items === 'string') {
      try { previousStatus.action_items = JSON.parse(previousStatus.action_items as string) } catch { previousStatus.action_items = [] }
    }
    if (typeof previousStatus.recent_decisions === 'string') {
      try { previousStatus.recent_decisions = JSON.parse(previousStatus.recent_decisions as string) } catch { previousStatus.recent_decisions = [] }
    }
  }

  // Fetch recent emails — no project_id filter (single-user app, all emails are relevant)
  const recentEmails = await db.getRecentEmails(14)

  // Build project context for AI
  const projectContext = {
    phase: project.phase || 'planning',
    currentStep,
    totalSteps,
    budgetUsed,
    budgetTotal
  }

  // Generate AI snapshot if there are emails OR a previous status to iterate on
  let snapshot
  if (recentEmails.length > 0 || previousStatus) {
    const emailsForAI: Email[] = recentEmails.map(e => ({
      subject: e.subject,
      from: e.sender_email,
      body: e.body_text || '',
      date: e.received_date
    }))
    snapshot = await generateProjectStatusSnapshot(emailsForAI, projectContext, previousStatus)
  } else {
    snapshot = {
      hot_topics: [],
      action_items: [],
      recent_decisions: [],
      ai_summary: 'No recent emails to analyze.'
    }
  }

  // Write to database
  await db.upsertProjectStatus(projectId, {
    phase: project.phase || 'planning',
    current_step: currentStep,
    progress_percentage: Math.round((currentStep / totalSteps) * 100),
    hot_topics: snapshot.hot_topics,
    action_items: snapshot.action_items,
    recent_decisions: snapshot.recent_decisions,
    budget_status: budgetUsed <= budgetTotal ? 'On Track' : 'Over Budget',
    budget_used: budgetUsed,
    ai_summary: snapshot.ai_summary
  })

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
