/**
 * AI Processing Queue Service
 *
 * The bridge between FrameWork (display layer) and Claude Code (intelligence layer).
 *
 * When FrameWork needs AI processing (email summary, bid extraction, etc.),
 * it can either:
 * 1. Call the Anthropic API directly (current behavior, for real-time needs)
 * 2. Queue the work for Claude Code to process (for batch/background needs)
 *
 * Claude Code picks up queue items via scheduled agents or on-demand.
 * Results are written back to both the queue and the source table.
 */

import { supabase } from './supabase'

export type AITaskType =
  | 'email_summary'
  | 'bid_extraction'
  | 'email_draft'
  | 'photo_analysis'
  | 'research'
  | 'bid_comparison'
  | 'document_analysis'
  | 'plan_takeoff'

export interface QueueItem {
  id: string
  project_id: string
  task_type: AITaskType
  priority: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  input_data: Record<string, unknown>
  source_id?: string
  source_type?: string
  result?: Record<string, unknown>
  error_message?: string
  processed_at?: string
  processed_by?: string
  attempts: number
  max_attempts: number
  created_at?: string
}

// ---------------------------------------------------------------------------
// Enqueue work
// ---------------------------------------------------------------------------

/** Add an item to the processing queue */
export async function enqueueAITask(
  projectId: string,
  taskType: AITaskType,
  inputData: Record<string, unknown>,
  options?: {
    priority?: number
    sourceId?: string
    sourceType?: string
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ai_processing_queue')
    .insert({
      project_id: projectId,
      task_type: taskType,
      priority: options?.priority ?? 5,
      input_data: inputData,
      source_id: options?.sourceId,
      source_type: options?.sourceType,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error enqueueing AI task:', error)
    return null
  }
  return data?.id ?? null
}

/** Bulk enqueue (e.g., all unsummarized emails) */
export async function enqueueBatch(
  projectId: string,
  items: Array<{
    taskType: AITaskType
    inputData: Record<string, unknown>
    sourceId?: string
    sourceType?: string
    priority?: number
  }>
): Promise<number> {
  const rows = items.map(item => ({
    project_id: projectId,
    task_type: item.taskType,
    priority: item.priority ?? 5,
    input_data: item.inputData,
    source_id: item.sourceId,
    source_type: item.sourceType,
    status: 'pending' as const,
  }))

  const { error } = await supabase.from('ai_processing_queue').insert(rows)
  if (error) {
    console.error('Error batch enqueueing:', error)
    return 0
  }
  return rows.length
}

// ---------------------------------------------------------------------------
// Dequeue work (for Claude Code to call)
// ---------------------------------------------------------------------------

/** Get next pending items for processing */
export async function dequeueAITasks(
  projectId: string,
  taskType?: AITaskType,
  limit = 10
): Promise<QueueItem[]> {
  let query = supabase
    .from('ai_processing_queue')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (taskType) query = query.eq('task_type', taskType)

  const { data, error } = await query
  if (error) return []

  // Mark as processing and increment attempts
  for (const item of (data || []) as QueueItem[]) {
    await supabase
      .from('ai_processing_queue')
      .update({ status: 'processing', attempts: item.attempts + 1 })
      .eq('id', item.id)
  }

  return (data || []) as QueueItem[]
}

/** Mark a queue item as completed with its result */
export async function completeQueueItem(
  itemId: string,
  result: Record<string, unknown>,
  processedBy = 'claude_code'
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_processing_queue')
    .update({
      status: 'completed',
      result,
      processed_at: new Date().toISOString(),
      processed_by: processedBy,
    })
    .eq('id', itemId)

  return !error
}

/** Mark a queue item as failed */
export async function failQueueItem(
  itemId: string,
  errorMessage: string
): Promise<boolean> {
  // Check if we should retry
  const { data: item } = await supabase
    .from('ai_processing_queue')
    .select('attempts, max_attempts')
    .eq('id', itemId)
    .single()

  const shouldRetry = item && item.attempts < item.max_attempts

  const { error } = await supabase
    .from('ai_processing_queue')
    .update({
      status: shouldRetry ? 'pending' : 'failed',
      error_message: errorMessage,
      next_attempt_at: shouldRetry
        ? new Date(Date.now() + 5 * 60 * 1000).toISOString() // Retry in 5 min
        : undefined,
    })
    .eq('id', itemId)

  return !error
}

// ---------------------------------------------------------------------------
// Queue stats (for dashboard)
// ---------------------------------------------------------------------------

export async function getQueueStats(projectId: string): Promise<{
  pending: number
  processing: number
  completed_today: number
  failed: number
  by_type: Record<string, number>
}> {
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabase
    .from('ai_processing_queue')
    .select('status, task_type')
    .eq('project_id', projectId)
    .gte('created_at', today)

  const stats = {
    pending: 0,
    processing: 0,
    completed_today: 0,
    failed: 0,
    by_type: {} as Record<string, number>,
  }

  if (data) {
    for (const item of data) {
      if (item.status === 'pending') stats.pending++
      else if (item.status === 'processing') stats.processing++
      else if (item.status === 'completed') stats.completed_today++
      else if (item.status === 'failed') stats.failed++

      stats.by_type[item.task_type] = (stats.by_type[item.task_type] || 0) + 1
    }
  }

  return stats
}

/** Get pending count (for orchestrator health check) */
export async function getPendingCount(projectId: string): Promise<number> {
  const { count } = await supabase
    .from('ai_processing_queue')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'pending')

  return count || 0
}
