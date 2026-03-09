import { supabase } from './supabase'
import { JobTreadService, getJobTreadService } from './jobtread'
import type { JTCostItem, JTTask, JTDailyLog, JTComment, JTFile } from './jobtread'
import type { JobTreadSyncResult, JobTreadFullSyncResult } from '@/types'

export class JobTreadSyncService {
  private jt: JobTreadService
  private projectId: string

  constructor(projectId: string, jtService?: JobTreadService) {
    const svc = jtService || getJobTreadService()
    if (!svc) throw new Error('JobTread not configured (missing API key)')
    this.jt = svc
    this.projectId = projectId
  }

  async syncAll(): Promise<JobTreadFullSyncResult> {
    const start = Date.now()
    const results: JobTreadSyncResult[] = []

    // Run syncs sequentially to respect rate limits
    results.push(await this.syncCostItems())
    results.push(await this.syncTasks())
    results.push(await this.syncDailyLogs())
    results.push(await this.syncComments())
    results.push(await this.syncFiles())

    const totalCreated = results.reduce((s, r) => s + r.created, 0)
    const totalUpdated = results.reduce((s, r) => s + r.updated, 0)

    console.log(`JobTread sync complete: ${totalCreated} created, ${totalUpdated} updated in ${Date.now() - start}ms`)

    return {
      results,
      totalCreated,
      totalUpdated,
      duration: Date.now() - start,
    }
  }

  async syncCostItems(): Promise<JobTreadSyncResult> {
    const result: JobTreadSyncResult = { entity: 'cost_items', created: 0, updated: 0, skipped: 0, errors: [] }

    try {
      const costItems = await this.jt.getCostItems()

      for (const item of costItems) {
        try {
          await this.upsertCostItem(item, result)
        } catch (e) {
          result.errors.push(`Cost item ${item.id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      await this.updateSyncState('cost_items', costItems.length)
    } catch (e) {
      result.errors.push(`Fetch failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    return result
  }

  async syncTasks(): Promise<JobTreadSyncResult> {
    const result: JobTreadSyncResult = { entity: 'tasks', created: 0, updated: 0, skipped: 0, errors: [] }

    try {
      const tasks = await this.jt.getTasks()

      for (const task of tasks) {
        try {
          await this.upsertTask(task, result)
        } catch (e) {
          result.errors.push(`Task ${task.id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      await this.updateSyncState('tasks', tasks.length)
    } catch (e) {
      result.errors.push(`Fetch failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    return result
  }

  async syncDailyLogs(): Promise<JobTreadSyncResult> {
    const result: JobTreadSyncResult = { entity: 'daily_logs', created: 0, updated: 0, skipped: 0, errors: [] }

    try {
      const logs = await this.jt.getDailyLogs()

      for (const log of logs) {
        try {
          await this.upsertCommunication(log.id, {
            date: log.date,
            summary: log.notes || '',
            type: 'daily_log',
            subject: `Daily Log — ${log.date}`,
          }, result)
        } catch (e) {
          result.errors.push(`Daily log ${log.id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      await this.updateSyncState('daily_logs', logs.length)
    } catch (e) {
      result.errors.push(`Fetch failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    return result
  }

  async syncComments(): Promise<JobTreadSyncResult> {
    const result: JobTreadSyncResult = { entity: 'comments', created: 0, updated: 0, skipped: 0, errors: [] }

    try {
      const comments = await this.jt.getComments()

      for (const comment of comments) {
        try {
          const date = comment.createdAt.split('T')[0]
          await this.upsertCommunication(comment.id, {
            date,
            summary: comment.message,
            type: 'jobtread_comment',
            subject: `JobTread Comment — ${date}`,
          }, result)
        } catch (e) {
          result.errors.push(`Comment ${comment.id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      await this.updateSyncState('comments', comments.length)
    } catch (e) {
      result.errors.push(`Fetch failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    return result
  }

  async syncFiles(): Promise<JobTreadSyncResult> {
    const result: JobTreadSyncResult = { entity: 'files', created: 0, updated: 0, skipped: 0, errors: [] }

    try {
      const files = await this.jt.getFiles()

      for (const file of files) {
        try {
          await this.upsertDocument(file, result)
        } catch (e) {
          result.errors.push(`File ${file.id}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      await this.updateSyncState('files', files.length)
    } catch (e) {
      result.errors.push(`Fetch failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    return result
  }

  // ─── Private Upsert Helpers ────────────────────────────────────

  private async upsertCostItem(item: JTCostItem, result: JobTreadSyncResult): Promise<void> {
    // Build description from name + specs
    const desc = item.description
      ? `${item.name} — ${item.description}`
      : item.name

    // Build notes with unit pricing details
    const noteParts: string[] = []
    if (item.quantity != null) noteParts.push(`Qty: ${item.quantity}`)
    if (item.unitCost != null) noteParts.push(`Unit cost: $${(item.unitCost / 100).toFixed(2)}`)
    if (item.unitPrice != null) noteParts.push(`Unit price: $${(item.unitPrice / 100).toFixed(2)}`)
    if (item.price != null) noteParts.push(`Total price: $${(item.price / 100).toFixed(2)}`)

    // JobTread stores costs in cents — convert to dollars
    const estimatedCost = item.cost != null ? item.cost / 100 : null

    const mapped = {
      project_id: this.projectId,
      jobtread_id: item.id,
      category: item.costCode?.name || 'Uncategorized',
      subcategory: item.costCode?.number || null,
      description: desc,
      estimated_cost: estimatedCost,
      status: 'estimated',
      source: 'jobtread',
      notes: noteParts.length > 0 ? noteParts.join(' | ') : null,
      updated_at: new Date().toISOString(),
    }

    const { error, status } = await supabase
      .from('budget_items')
      .upsert(mapped, { onConflict: 'jobtread_id' })

    if (error) {
      result.errors.push(`${item.name}: ${error.message}`)
    } else {
      // 201 = created, 200/204 = updated
      if (status === 201) result.created++
      else result.updated++
    }
  }

  private async upsertTask(task: JTTask, result: JobTreadSyncResult): Promise<void> {
    const status = task.completed
      ? 'completed'
      : (task.progress && task.progress > 0 ? 'in_progress' : 'pending')

    const noteParts: string[] = []
    if (task.startDate) noteParts.push(`Start: ${task.startDate}`)
    if (task.progress != null && task.progress > 0) noteParts.push(`Progress: ${task.progress}%`)
    if (task.taskType?.name) noteParts.push(`Type: ${task.taskType.name}`)
    noteParts.push('[jobtread-synced]')

    const mapped = {
      project_id: this.projectId,
      jobtread_id: task.id,
      title: task.name,
      description: task.description || null,
      due_date: task.endDate || null,
      status,
      priority: 'medium' as const,
      notes: noteParts.join(' | '),
      updated_at: new Date().toISOString(),
    }

    const { error, status: httpStatus } = await supabase
      .from('tasks')
      .upsert(mapped, { onConflict: 'jobtread_id' })

    if (error) {
      result.errors.push(`${task.name}: ${error.message}`)
    } else {
      if (httpStatus === 201) result.created++
      else result.updated++
    }
  }

  private async upsertCommunication(
    jtId: string,
    data: { date: string; summary: string; type: string; subject: string },
    result: JobTreadSyncResult,
  ): Promise<void> {
    const mapped = {
      project_id: this.projectId,
      jobtread_id: jtId,
      date: data.date,
      type: data.type,
      subject: data.subject,
      summary: data.summary,
      updated_at: new Date().toISOString(),
    }

    const { error, status } = await supabase
      .from('communications')
      .upsert(mapped, { onConflict: 'jobtread_id' })

    if (error) {
      result.errors.push(`${data.subject}: ${error.message}`)
    } else {
      if (status === 201) result.created++
      else result.updated++
    }
  }

  private async upsertDocument(file: JTFile, result: JobTreadSyncResult): Promise<void> {
    const mapped = {
      project_id: this.projectId,
      jobtread_id: file.id,
      name: file.name,
      file_url: file.url,
      file_size: file.size,
      category: file.folder || 'JobTread',
      upload_date: file.createdAt,
      updated_at: new Date().toISOString(),
    }

    const { error, status } = await supabase
      .from('documents')
      .upsert(mapped, { onConflict: 'jobtread_id' })

    if (error) {
      result.errors.push(`${file.name}: ${error.message}`)
    } else {
      if (status === 201) result.created++
      else result.updated++
    }
  }

  // ─── Sync State Tracking ───────────────────────────────────────

  private async updateSyncState(entityType: string, count: number): Promise<void> {
    await supabase
      .from('jobtread_sync_state')
      .upsert({
        project_id: this.projectId,
        entity_type: entityType,
        last_sync: new Date().toISOString(),
        last_sync_count: count,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,entity_type' })
  }
}
