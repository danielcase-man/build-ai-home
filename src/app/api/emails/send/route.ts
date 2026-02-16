import { NextRequest } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { cookies } from 'next/headers'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { AuthenticationError } from '@/lib/errors'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, body: htmlBody } = body

    if (!to || !subject || !htmlBody) {
      return validationError('Missing required fields: to, subject, body')
    }

    const cookieStore = await cookies()
    const accessToken = cookieStore.get('gmail_access_token')
    const refreshToken = cookieStore.get('gmail_refresh_token')

    if (!accessToken) {
      throw new AuthenticationError()
    }

    const gmailService = new GmailService()
    gmailService.setCredentials({
      access_token: accessToken.value,
      refresh_token: refreshToken?.value
    })

    // Refresh token if expired
    if (gmailService.isTokenExpired()) {
      const newTokens = await gmailService.refreshAccessToken()
      if (!newTokens) {
        throw new AuthenticationError('Failed to refresh Gmail token')
      }
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
