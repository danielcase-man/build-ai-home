import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Authentication middleware for API route protection.
 *
 * Strategy: Page loads set an httpOnly session cookie. API routes require it.
 * This ensures only requests originating from our own pages can call the API,
 * preventing external abuse of endpoints like /api/emails/send.
 *
 * Exceptions:
 * - OAuth callback and Gmail auth initiation (part of the auth flow itself)
 * - Cron and admin routes (use their own Bearer token auth)
 */

const PUBLIC_API_PREFIXES = [
  '/api/auth/',      // OAuth callback
  '/api/gmail/auth', // OAuth initiation
  '/api/cron/',      // Has its own Bearer token auth
  '/api/admin/',     // Has its own Bearer token auth
]

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function getSessionToken(): string {
  const secret = process.env.CRON_SECRET || ''
  // Derive a simple hash from the server secret so the raw secret isn't stored in the cookie
  let hash = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < secret.length; i++) {
    hash ^= secret.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) // FNV prime
  }
  return `s_${(hash >>> 0).toString(36)}`
}

const SESSION_COOKIE = 'app_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes: enforce session cookie (except public routes)
  if (pathname.startsWith('/api/')) {
    if (isPublicApiRoute(pathname)) {
      return NextResponse.next()
    }

    const session = request.cookies.get(SESSION_COOKIE)
    if (!session || session.value !== getSessionToken()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.next()
  }

  // Page routes: set the session cookie if missing or stale
  const response = NextResponse.next()
  const session = request.cookies.get(SESSION_COOKIE)
  const expectedToken = getSessionToken()

  if (!session || session.value !== expectedToken) {
    response.cookies.set(SESSION_COOKIE, expectedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico and other static assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
