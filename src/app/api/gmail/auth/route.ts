import { NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const gmailService = new GmailService()
    const authUrl = gmailService.getAuthUrl()

    return successResponse({ authUrl })
  } catch (error) {
    return errorResponse(error, 'Failed to generate auth URL')
  }
}
