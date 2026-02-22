import { NextRequest } from 'next/server'
import { getAuthenticatedGmailService } from '@/lib/gmail-auth'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { AuthenticationError } from '@/lib/errors'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, body: htmlBody } = body

    if (!to || !subject || !htmlBody) {
      return validationError('Missing required fields: to, subject, body')
    }

    const gmailService = await getAuthenticatedGmailService()
    if (!gmailService) {
      throw new AuthenticationError('Gmail not connected or token refresh failed')
    }

    const messageId = await gmailService.sendEmail(to, subject, htmlBody)

    if (!messageId) {
      return errorResponse(new Error('Gmail API returned no message ID'), 'Failed to send email')
    }

    return successResponse({ messageId })
  } catch (error) {
    return errorResponse(error, 'Failed to send email')
  }
}
