import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { pushItem, getLocalPushableItems } from '@/lib/jobtread-push'
import { getProject } from '@/lib/project-service'
import { env } from '@/lib/env'
import type { JobTreadPushItem } from '@/types'

export async function GET() {
  try {
    if (!env.jobtreadApiKey) {
      return successResponse({ items: [], message: 'JobTread not configured' })
    }

    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const items = await getLocalPushableItems(project.id)
    return successResponse({ items })
  } catch (error) {
    return errorResponse(error, 'Failed to get pushable items')
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!env.jobtreadApiKey) {
      return errorResponse(new Error('JobTread not configured'), 'JobTread not configured')
    }

    const body = await request.json() as JobTreadPushItem
    if (!body.type || !body.label) {
      return errorResponse(new Error('Invalid push item'), 'Missing required fields: type, label')
    }

    const result = await pushItem(body)
    if (!result.success) {
      return errorResponse(new Error(result.error || 'Push failed'), result.error || 'Push failed')
    }

    return successResponse(result)
  } catch (error) {
    return errorResponse(error, 'JobTread push failed')
  }
}
