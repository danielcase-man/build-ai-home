import { supabase } from './supabase'
import type { ProjectStatusData, DashboardData } from '@/types'

export async function getProject() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching project:', error)
  }

  return data
}

export async function getProjectDashboard(): Promise<DashboardData> {
  const project = await getProject()

  if (!project) {
    return getDefaultDashboard()
  }

  // Get planning steps count
  const { count: completedSteps } = await supabase
    .from('planning_phase_steps')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('status', 'completed')

  const { count: totalSteps } = await supabase
    .from('planning_phase_steps')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)

  // Get budget info
  const { data: budgetItems } = await supabase
    .from('budget_items')
    .select('estimated_cost, actual_cost')
    .eq('project_id', project.id)

  const budgetUsed = budgetItems?.reduce((sum, item) =>
    sum + (parseFloat(item.actual_cost) || parseFloat(item.estimated_cost) || 0), 0) || 0

  // Get unread email count
  const { count: unreadEmails } = await supabase
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('is_read', false)

  // Get pending tasks
  const { count: pendingTasks } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .in('status', ['pending', 'in_progress'])

  // Get next milestone
  const { data: nextMilestone } = await supabase
    .from('milestones')
    .select('name, target_date')
    .eq('project_id', project.id)
    .in('status', ['pending', 'in_progress'])
    .order('target_date', { ascending: true })
    .limit(1)

  const createdAt = new Date(project.created_at)
  const daysElapsed = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  return {
    phase: project.phase || 'Planning',
    currentStep: (completedSteps || 0) + 1,
    totalSteps: totalSteps || 6,
    daysElapsed,
    totalDays: project.estimated_duration_days || 117,
    budgetUsed,
    budgetTotal: parseFloat(project.budget_total) || 450000,
    unreadEmails: unreadEmails || 0,
    pendingTasks: pendingTasks || 0,
    upcomingMilestone: nextMilestone?.[0]?.name || '',
    milestoneDate: nextMilestone?.[0]?.target_date || ''
  }
}

export async function getProjectStatus(): Promise<ProjectStatusData | null> {
  const project = await getProject()

  if (!project) {
    return null
  }

  // Get latest project_status record
  const { data: statusRecord } = await supabase
    .from('project_status')
    .select('*')
    .eq('project_id', project.id)
    .order('date', { ascending: false })
    .limit(1)

  const latestStatus = statusRecord?.[0]

  // Get hot topics
  const { data: hotTopicsData } = await supabase
    .from('project_status')
    .select('hot_topics')
    .eq('project_id', project.id)
    .order('date', { ascending: false })
    .limit(1)

  const hotTopics = (hotTopicsData?.[0]?.hot_topics || []) as Array<{ priority: string; text: string }>

  // Get action items (tasks)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('title, status')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const actionItems = (tasks || []).map(t => ({
    status: t.status === 'completed' ? 'completed' : t.status === 'in_progress' ? 'in-progress' : 'pending',
    text: t.title
  }))

  // Get recent communications
  const { data: emails } = await supabase
    .from('emails')
    .select('sender_name, ai_summary')
    .eq('project_id', project.id)
    .order('received_date', { ascending: false })
    .limit(5)

  const recentCommunications = (emails || []).map(e => ({
    from: e.sender_name || 'Unknown',
    summary: e.ai_summary || 'No summary available'
  }))

  // Get recent decisions
  const recentDecisions = (latestStatus?.recent_decisions || []) as Array<{ decision: string; impact: string }>

  // Get budget info
  const { data: budgetItems } = await supabase
    .from('budget_items')
    .select('estimated_cost, actual_cost')
    .eq('project_id', project.id)

  const budgetUsed = budgetItems?.reduce((sum, item) =>
    sum + (parseFloat(item.actual_cost) || parseFloat(item.estimated_cost) || 0), 0) || 0

  // Get planning steps
  const { count: completedSteps } = await supabase
    .from('planning_phase_steps')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('status', 'completed')

  const { count: totalSteps } = await supabase
    .from('planning_phase_steps')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)

  const stepNum = (completedSteps || 0) + 1
  const stepsTotal = totalSteps || 6
  const createdAt = new Date(project.created_at)
  const daysElapsed = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
  const totalDays = project.estimated_duration_days || 117

  // Get next milestone
  const { data: nextMilestone } = await supabase
    .from('milestones')
    .select('name, target_date')
    .eq('project_id', project.id)
    .in('status', ['pending', 'in_progress'])
    .order('target_date', { ascending: true })
    .limit(1)

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
    milestoneDate: ''
  }
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
