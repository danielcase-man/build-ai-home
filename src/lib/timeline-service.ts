import { supabase } from './supabase'
import type { TimelineTask } from '@/components/construction/timeline-chart'

interface MilestoneRecord {
  id: string
  name: string
  description: string | null
  target_date: string | null
  completed_date: string | null
  status: string
  dependencies: string[] | null
  notes: string | null
}

interface TaskRecord {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: string
  status: string
  milestone_id: string | null
  created_at: string
}

function mapStatus(status: string): TimelineTask['status'] {
  switch (status) {
    case 'completed': return 'COMPLETED'
    case 'in_progress': return 'IN_PROGRESS'
    case 'delayed': return 'DELAYED'
    case 'on_hold': return 'ON_HOLD'
    default: return 'PENDING'
  }
}

function mapPriority(priority: string): TimelineTask['priority'] {
  switch (priority) {
    case 'urgent': return 'URGENT'
    case 'high': return 'HIGH'
    case 'low': return 'LOW'
    default: return 'MEDIUM'
  }
}

function getProgress(status: string): number {
  switch (status) {
    case 'completed': return 100
    case 'in_progress': return 50
    default: return 0
  }
}

export async function getTimelineData(projectId: string): Promise<TimelineTask[]> {
  const [{ data: milestones }, { data: tasks }] = await Promise.all([
    supabase
      .from('milestones')
      .select('id, name, description, target_date, completed_date, status, dependencies, notes')
      .eq('project_id', projectId)
      .order('target_date', { ascending: true }),
    supabase
      .from('tasks')
      .select('id, title, description, due_date, priority, status, milestone_id, created_at')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true }),
  ])

  const timelineTasks: TimelineTask[] = []

  // Map milestones to timeline tasks
  for (const m of (milestones || []) as MilestoneRecord[]) {
    const endDate = m.completed_date || m.target_date
    if (!endDate) continue

    const end = new Date(endDate)
    // Milestones span from 2 weeks before target to target (or use completed_date)
    const start = new Date(end)
    start.setDate(start.getDate() - 14)

    timelineTasks.push({
      id: m.id,
      name: m.name,
      description: m.description || undefined,
      startDate: start,
      endDate: end,
      progress: getProgress(m.status),
      status: mapStatus(m.status),
      dependencies: m.dependencies || undefined,
      phase: 'Milestones',
      priority: 'HIGH',
    })
  }

  // Map tasks to timeline tasks — only include tasks with real due dates
  // (tasks without due_date are AI-generated action items, not scheduled work)
  for (const t of (tasks || []) as TaskRecord[]) {
    if (!t.due_date) continue // Skip tasks without a real scheduled date

    const end = new Date(t.due_date)
    const start = new Date(end)
    start.setDate(start.getDate() - 7)

    timelineTasks.push({
      id: t.id,
      name: t.title,
      description: t.description || undefined,
      startDate: start,
      endDate: end,
      progress: getProgress(t.status),
      status: mapStatus(t.status),
      phase: 'Tasks',
      priority: mapPriority(t.priority),
    })
  }

  return timelineTasks
}
