import { getProject } from '@/lib/project-service'
import { getUnreadCount } from '@/lib/notification-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) {
      return successResponse({ unreadCount: 0 })
    }

    const unreadCount = await getUnreadCount(project.id)

    return successResponse({ unreadCount })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch notification count')
  }
}
