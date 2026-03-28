import { supabase } from '@/lib/supabase'
import { getProject } from '@/lib/project-service'
import { checkAndCompleteSelectionDecisions } from '@/lib/workflow-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import type { SelectionStatus } from '@/types'

const VALID_STATUSES: SelectionStatus[] = ['considering', 'selected', 'ordered', 'received', 'installed', 'alternative']

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { category, newStatus, fromStatus } = body

    if (!category || !newStatus) {
      return validationError('category and newStatus are required')
    }

    if (!VALID_STATUSES.includes(newStatus)) {
      return validationError(`Invalid status: ${newStatus}`)
    }

    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    // Build query: update all non-alternative selections in category
    let query = supabase
      .from('selections')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('project_id', project.id)
      .eq('category', category)
      .neq('status', 'alternative')

    if (fromStatus) {
      query = query.eq('status', fromStatus)
    }

    const { data, error } = await query.select()

    if (error) {
      return errorResponse(error, 'Failed to batch update selections')
    }

    // Trigger workflow completion check
    checkAndCompleteSelectionDecisions(project.id, category).catch(() => {})

    return successResponse({ updated: data?.length ?? 0 })
  } catch (error) {
    return errorResponse(error, 'Failed to batch update selections')
  }
}
