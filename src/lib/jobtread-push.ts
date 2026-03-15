import { supabase } from './supabase'
import { getJobTreadService } from './jobtread'
import type { JobTreadPushItem, JobTreadPushResult } from '@/types'

export async function pushItem(item: JobTreadPushItem): Promise<JobTreadPushResult> {
  const jt = getJobTreadService()
  if (!jt) {
    return { success: false, type: item.type, label: item.label, error: 'JobTread not configured' }
  }

  try {
    let jobtreadId: string | undefined

    switch (item.type) {
      case 'create_task': {
        const result = await jt.createTask(
          item.data.name as string,
          {
            description: item.data.description as string | undefined,
            startDate: item.data.startDate as string | undefined,
            endDate: item.data.endDate as string | undefined,
          }
        )
        jobtreadId = result.id
        if (item.localId) {
          await supabase.from('tasks').update({ jobtread_id: jobtreadId }).eq('id', item.localId)
        }
        break
      }

      case 'update_task': {
        if (!item.jobtreadId) throw new Error('jobtreadId required for update_task')
        const fields: Record<string, unknown> = {}
        if (item.data.name != null) fields.name = item.data.name
        if (item.data.description != null) fields.description = item.data.description
        if (item.data.completed != null) fields.completed = item.data.completed
        if (item.data.startDate != null) fields.startDate = item.data.startDate
        if (item.data.endDate != null) fields.endDate = item.data.endDate
        await jt.updateTask(item.jobtreadId, fields)
        jobtreadId = item.jobtreadId
        break
      }

      case 'create_daily_log': {
        const result = await jt.createDailyLog(
          item.data.date as string,
          item.data.notes as string
        )
        jobtreadId = result.id
        break
      }

      case 'create_comment': {
        const result = await jt.createComment(item.data.message as string)
        jobtreadId = result.id
        break
      }

      case 'create_cost_item': {
        const costInCents = Math.round((item.data.cost as number) * 100)
        const unitCostCents = item.data.unitCost ? Math.round((item.data.unitCost as number) * 100) : undefined
        const result = await jt.createCostItem({
          name: item.data.name as string,
          description: item.data.description as string | undefined,
          cost: costInCents,
          quantity: item.data.quantity as number | undefined,
          unitCost: unitCostCents,
        })
        jobtreadId = result.id
        if (item.localId) {
          await supabase.from('budget_items').update({ jobtread_id: jobtreadId }).eq('id', item.localId)
        }
        break
      }

      case 'update_cost_item': {
        if (!item.jobtreadId) throw new Error('jobtreadId required for update_cost_item')
        const costFields: Record<string, unknown> = {}
        if (item.data.name != null) costFields.name = item.data.name
        if (item.data.cost != null) costFields.cost = Math.round((item.data.cost as number) * 100)
        if (item.data.quantity != null) costFields.quantity = item.data.quantity
        if (item.data.unitCost != null) costFields.unitCost = Math.round((item.data.unitCost as number) * 100)
        await jt.updateCostItem(item.jobtreadId, costFields)
        jobtreadId = item.jobtreadId
        break
      }

      default:
        return { success: false, type: item.type, label: item.label, error: `Unknown push type: ${item.type}` }
    }

    return { success: true, type: item.type, label: item.label, jobtreadId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`JobTread push failed [${item.type}]:`, message)
    return { success: false, type: item.type, label: item.label, error: message }
  }
}

export async function getLocalPushableItems(projectId: string): Promise<JobTreadPushItem[]> {
  const items: JobTreadPushItem[] = []

  // Tasks without jobtread_id (can be created in JobTread)
  const { data: newTasks } = await supabase
    .from('tasks')
    .select('id, title, description, due_date, status')
    .eq('project_id', projectId)
    .is('jobtread_id', null)
    .neq('status', 'cancelled')

  for (const task of newTasks || []) {
    items.push({
      type: 'create_task',
      localId: task.id,
      label: task.title,
      data: {
        name: task.title,
        description: task.description || undefined,
        endDate: task.due_date || undefined,
      },
    })
  }

  // Tasks with jobtread_id where local status is 'completed' but might not be synced
  const { data: completedTasks } = await supabase
    .from('tasks')
    .select('id, title, jobtread_id, status')
    .eq('project_id', projectId)
    .not('jobtread_id', 'is', null)
    .eq('status', 'completed')

  for (const task of completedTasks || []) {
    items.push({
      type: 'update_task',
      localId: task.id,
      jobtreadId: task.jobtread_id,
      label: `Mark complete: ${task.title}`,
      data: { completed: 1 },
    })
  }

  // Budget items without jobtread_id that were manually created
  const { data: newBudgetItems } = await supabase
    .from('budget_items')
    .select('id, category, subcategory, description, estimated_cost')
    .eq('project_id', projectId)
    .is('jobtread_id', null)
    .or('source.is.null,source.eq.manual')

  for (const item of newBudgetItems || []) {
    const name = [item.category, item.subcategory, item.description].filter(Boolean).join(' - ')
    items.push({
      type: 'create_cost_item',
      localId: item.id,
      label: name || 'Budget Item',
      data: {
        name: name || 'Budget Item',
        description: item.description || undefined,
        cost: parseFloat(item.estimated_cost) || 0,
      },
    })
  }

  return items
}
