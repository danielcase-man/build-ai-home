import { NextRequest, NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { db } from '@/lib/database'
import { env } from '@/lib/env'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.redirect(new URL('/?error=no_code', request.url))
    }

    const gmailService = new GmailService()
    const tokens = await gmailService.getTokens(code)

    // Store tokens in database and cookies
    const userEmail = env.gmailUserEmail || 'user@example.com'

    // Store in database for automated syncing
    await db.upsertEmailAccount({
      email_address: userEmail,
      provider: 'gmail',
      oauth_tokens: tokens,
      sync_enabled: true,
      sync_frequency: 30
    })

    const response = NextResponse.redirect(new URL('/?success=connected', request.url))

    // Store tokens in cookies for immediate use
    response.cookies.set('gmail_access_token', tokens.access_token || '', {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })

    if (tokens.refresh_token) {
      response.cookies.set('gmail_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: env.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30
      })
    }

    return response
  } catch (error) {
    console.error('Error in Google OAuth callback:', error)
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url))
  }
}
