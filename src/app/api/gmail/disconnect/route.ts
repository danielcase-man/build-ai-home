import { db } from '@/lib/database'
import { env } from '@/lib/env'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function POST() {
  try {
    const email = env.gmailUserEmail
    if (!email) {
      return errorResponse(new Error('GMAIL_USER_EMAIL not configured'), 'Gmail not configured')
    }

    const cleared = await db.clearEmailAccountTokens(email)
    if (!cleared) {
      return errorResponse(new Error('Failed to clear tokens'), 'Failed to disconnect Gmail')
    }

    return successResponse({ disconnected: true })
  } catch (error) {
    return errorResponse(error, 'Failed to disconnect Gmail')
  }
}
