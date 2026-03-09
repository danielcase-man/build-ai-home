import { NextRequest } from 'next/server'
import { getProject } from '@/lib/project-service'
import { getNotifications, markAsRead, markAllAsRead } from '@/lib/notification-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) {
      return successResponse({ notifications: [], unreadCount: 0 })
    }

    const notifications = await getNotifications(project.id)

    return successResponse({ notifications })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch notifications')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const body = await request.json()

    if (body.markAllRead) {
      await markAllAsRead(project.id)
      return successResponse({ message: 'All notifications marked as read' })
    }

    if (body.notificationId) {
      await markAsRead(body.notificationId)
      return successResponse({ message: 'Notification marked as read' })
    }

    return errorResponse(new Error('Invalid request'), 'Provide notificationId or markAllRead')
  } catch (error) {
    return errorResponse(error, 'Failed to update notification')
  }
}
