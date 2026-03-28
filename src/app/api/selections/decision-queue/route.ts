import { getSelectionDecisionQueue } from '@/lib/selection-decision-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const result = await getSelectionDecisionQueue(project.id)
    return successResponse(result)
  } catch (error) {
    return errorResponse(error, 'Failed to load decision queue')
  }
}
