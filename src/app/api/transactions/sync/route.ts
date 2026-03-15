import { syncAllConnections } from '@/lib/plaid-sync'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function POST() {
  try {
    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const result = await syncAllConnections(project.id)
    return successResponse(result)
  } catch (error) {
    return errorResponse(error, 'Failed to sync transactions')
  }
}
