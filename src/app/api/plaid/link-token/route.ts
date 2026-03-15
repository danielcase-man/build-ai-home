import { createLinkToken } from '@/lib/plaid-client'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function POST() {
  try {
    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const linkToken = await createLinkToken(project.id)
    return successResponse({ link_token: linkToken })
  } catch (error) {
    return errorResponse(error, 'Failed to create Plaid link token')
  }
}
