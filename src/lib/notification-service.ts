import { supabase } from './supabase'

export interface Notification {
  id: string
  project_id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  message: string | null
  email_id: string | null
  created_at: string
  sent_at: string | null
  read_at: string | null
  channel: 'in_app' | 'push' | 'email' | 'sms' | null
}

export async function createNotification(params: {
  projectId: string
  type: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  message?: string
  emailId?: string
}): Promise<void> {
  const { error } = await supabase
    .from('notification_queue')
    .insert({
      project_id: params.projectId,
      type: params.type,
      priority: params.priority || 'medium',
      title: params.title,
      message: params.message || null,
      email_id: params.emailId || null,
      channel: 'in_app',
    })

  // Silently ignore — notification creation is best-effort
  if (error) return
}

export async function getUnreadCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notification_queue')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .is('read_at', null)

  if (error) return 0

  return count || 0
}

export async function getNotifications(
  projectId: string,
  limit = 20
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  return data || []
}

export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_queue')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)

  // Best-effort — silently ignore errors
  if (error) return
}

export async function markAllAsRead(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_queue')
    .update({ read_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .is('read_at', null)

  // Best-effort — silently ignore errors
  if (error) return
}

export async function createEmailSyncNotification(
  projectId: string,
  newEmailCount: number
): Promise<void> {
  if (newEmailCount === 0) return

  await createNotification({
    projectId,
    type: 'email_sync',
    priority: 'low',
    title: `${newEmailCount} new email${newEmailCount === 1 ? '' : 's'} synced`,
    message: `${newEmailCount} new email${newEmailCount === 1 ? ' was' : 's were'} synced from Gmail.`,
  })
}

export async function createDeadlineNotification(
  projectId: string,
  taskTitle: string,
  dueDate: string
): Promise<void> {
  await createNotification({
    projectId,
    type: 'deadline',
    priority: 'high',
    title: `Upcoming deadline: ${taskTitle}`,
    message: `Task "${taskTitle}" is due on ${dueDate}.`,
  })
}

export async function createActionItemNotification(
  projectId: string,
  actionText: string
): Promise<void> {
  await createNotification({
    projectId,
    type: 'action_item',
    priority: 'high',
    title: 'New high-priority action item',
    message: actionText,
  })
}

export async function createWorkflowAlertNotification(
  projectId: string,
  alertType: 'blocker' | 'decision_needed' | 'ready_to_start',
  itemName: string,
  message: string
): Promise<void> {
  const priorities: Record<string, 'low' | 'medium' | 'high'> = {
    blocker: 'high',
    decision_needed: 'medium',
    ready_to_start: 'low',
  }

  const titles: Record<string, string> = {
    blocker: `Blocked: ${itemName}`,
    decision_needed: `Decision needed: ${itemName}`,
    ready_to_start: `Ready to start: ${itemName}`,
  }

  await createNotification({
    projectId,
    type: 'workflow_alert',
    priority: priorities[alertType] || 'medium',
    title: titles[alertType] || `Workflow: ${itemName}`,
    message,
  })
}
