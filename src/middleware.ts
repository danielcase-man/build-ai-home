import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Auth middleware — protects all routes except public ones.
 *
 * Flow:
 *   1. Refresh Supabase session (extends cookie expiry)
 *   2. Check if route is public (login, register, invite, cron, webhook, static)
 *   3. If not public and no session → redirect to /login
 *   4. If authenticated → continue with session cookie refreshed
 */

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/privacy',
  '/invite/',           // Vendor invitation acceptance
  '/api/auth/',         // OAuth callbacks
  '/api/gmail/auth',    // OAuth initiation
  '/api/cron/',         // Has Bearer token auth
  '/api/admin/',        // Has Bearer token auth
  '/api/plaid/webhook', // Has JWK signature verification
  '/api/vendors/invite/accept', // Public invitation validation
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth for static assets
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/manifest.json') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|css|js)$/)
  ) {
    return NextResponse.next()
  }

  // Create response that we'll modify with refreshed cookies
  let response = NextResponse.next({ request })

  // Refresh the Supabase auth session (extends cookie expiry)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()

  // Public routes: allow through (with refreshed cookies if logged in)
  if (isPublicRoute(pathname)) {
    // If already logged in and hitting /login, redirect to dashboard
    if (user && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Protected routes: redirect to login if no session
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    // Preserve the intended destination so we can redirect back after login
    loginUrl.searchParams.set('redirect', pathname)
    response = NextResponse.redirect(loginUrl)
    return response
  }

  // Authenticated: continue with refreshed session
  return response
}

export const config = {
  matcher: [
    /*
     * Match all routes except _next/static, _next/image, and static files.
     */
    '/((?!_next/static|_next/image).*)',
  ],
}
