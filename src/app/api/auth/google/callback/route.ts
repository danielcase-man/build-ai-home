import { NextRequest, NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { db } from '@/lib/database'
import { env } from '@/lib/env'
import { encryptTokens } from '@/lib/token-encryption'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.redirect(new URL('/?error=no_code', request.url))
    }

    const gmailService = new GmailService()
    const tokens = await gmailService.getTokens(code)

    const userEmail = env.gmailUserEmail || 'user@example.com'

    // Store encrypted tokens in database (single source of truth)
    await db.upsertEmailAccount({
      email_address: userEmail,
      provider: 'gmail',
      oauth_tokens: encryptTokens(tokens as Record<string, unknown>),
      sync_enabled: true,
      sync_frequency: 30
    })

    return NextResponse.redirect(new URL('/?success=connected', request.url))
  } catch (error) {
    console.error('Error in Google OAuth callback:', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }
}
