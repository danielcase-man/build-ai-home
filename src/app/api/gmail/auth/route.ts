import { NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { successResponse, errorResponse } from '@/lib/api-utils'
import crypto from 'crypto'

export async function GET() {
  try {
    const gmailService = new GmailService()

    // P0 fix: Generate CSRF state token for OAuth flow
    const state = crypto.randomBytes(32).toString('hex')
    const authUrl = gmailService.getAuthUrl(state)

    // Return state so the client can store it for callback verification
    return successResponse({ authUrl, state })
  } catch (error) {
    return errorResponse(error, 'Failed to generate auth URL')
  }
}
