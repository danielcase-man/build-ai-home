import { getProjectStatus } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const status = await getProjectStatus()

    if (!status) {
      return successResponse({
        message: 'No project found',
        status: null
      })
    }

    return successResponse({ status })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch project status')
  }
}
