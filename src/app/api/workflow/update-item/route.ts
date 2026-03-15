import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import {
  startWorkflowItem,
  completeWorkflowItem,
  blockWorkflowItem,
  recordDecision,
} from '@/lib/workflow-service'
import { logChange } from '@/lib/audit-service'

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const body = await request.json()
    const { knowledge_id, action, completed_date, actual_cost, notes, blocking_reason, selected_option } = body

    if (!knowledge_id) {
      return validationError('Missing required field: knowledge_id')
    }
    if (!action) {
      return validationError('Missing required field: action (start, complete, block, decide)')
    }

    let result = null

    switch (action) {
      case 'start':
        result = await startWorkflowItem(project.id, knowledge_id)
        break

      case 'complete':
        result = await completeWorkflowItem(project.id, knowledge_id, {
          completedDate: completed_date,
          actualCost: actual_cost ? Number(actual_cost) : undefined,
          notes,
        })
        break

      case 'block':
        if (!blocking_reason) {
          return validationError('Missing blocking_reason for block action')
        }
        result = await blockWorkflowItem(project.id, knowledge_id, blocking_reason)
        break

      case 'decide':
        if (!selected_option) {
          return validationError('Missing selected_option for decide action')
        }
        result = await recordDecision(project.id, knowledge_id, selected_option, notes)
        break

      default:
        return validationError(`Invalid action: ${action}. Use start, complete, block, or decide.`)
    }

    if (!result) {
      return errorResponse(new Error('Update failed'), 'Failed to update workflow item')
    }

    // Audit log
    await logChange({
      projectId: project.id,
      entityType: 'workflow_item',
      entityId: knowledge_id,
      action: 'update',
      fieldName: 'status',
      newValue: result.status,
      actor: 'user',
    })

    return successResponse({ state: result })
  } catch (error) {
    return errorResponse(error, 'Failed to update workflow item')
  }
}
