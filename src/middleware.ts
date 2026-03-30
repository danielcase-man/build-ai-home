import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Auth + Authorization middleware.
 *
 * Flow:
 *   1. Refresh Supabase session (extends cookie expiry)
 *   2. Check if route is public → allow through
 *   3. No session → redirect to /login
 *   4. Has session → look up user role, enforce RBAC
 */

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/privacy',
  '/invite/',           // Invitation acceptance
  '/api/auth/',         // OAuth callbacks + /api/auth/me
  '/api/gmail/auth',    // OAuth initiation
  '/api/cron/',         // Has Bearer token auth
  '/api/intelligence/', // Has Bearer token auth
  '/api/admin/',        // Has Bearer token auth
  '/api/plaid/webhook', // Has JWK signature verification
  '/api/webhooks/',     // Has HMAC signature verification
  '/api/vendors/invite/accept', // Public invitation validation
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

// ─── RBAC: Permission Matrix (inlined for middleware performance) ────────────

type UserRole = 'owner' | 'consultant' | 'vendor'

/**
 * Map a pathname to a permission key.
 * Returns [permissionKey, isApi]
 */
function getPermissionKey(pathname: string): string {
  const segments = pathname.replace(/^\//, '').split('/')

  if (segments[0] === 'api') {
    const apiMapping: Record<string, string> = {
      'bids': 'bids', 'financing': 'financing', 'payments': 'payments',
      'transactions': 'transactions', 'selections': 'selections', 'emails': 'emails',
      'project-status': 'project-status', 'change-orders': 'change-orders',
      'vendors': 'vendors', 'documents': 'documents', 'punch-list': 'punch-list',
      'warranties': 'warranties', 'audit': 'audit', 'assistant': 'assistant',
      'workflow': 'workflow', 'search': 'dashboard', 'notifications': 'dashboard',
      'knowledge': 'workflow', 'research': 'assistant', 'export': 'budget',
      'upload': 'documents', 'photos': 'documents', 'inspections': 'punch-list',
      'contracts': 'payments', 'invoices': 'payments', 'draw-schedule': 'financing',
      'vendor-threads': 'vendors', 'email-templates': 'emails', 'plaid': 'financing',
      'jobtread': 'admin', 'gmail': 'emails',
    }
    return apiMapping[segments[1]] || 'dashboard'
  }

  return segments[0] || 'dashboard'
}

/** Routes that each role CANNOT access at all */
const BLOCKED_ROUTES: Record<UserRole, Set<string>> = {
  owner: new Set(), // owner can access everything
  consultant: new Set([
    'budget', 'financing', 'payments', 'transactions', 'audit', 'admin',
  ]),
  vendor: new Set([
    'budget', 'financing', 'payments', 'transactions', 'audit', 'admin',
    'emails', 'project-status', 'assistant', 'timeline', 'workflow',
    'selections', 'coverage', 'vendors', 'warranties',
  ]),
}

/** Routes where only owners can write (POST/PATCH/PUT/DELETE) */
const READ_ONLY_ROUTES: Record<UserRole, Set<string>> = {
  owner: new Set(),
  consultant: new Set([
    'dashboard', 'bids', 'change-orders', 'documents', 'punch-list',
    'project-status', 'assistant', 'timeline', 'workflow', 'selections',
    'coverage', 'vendors', 'warranties', 'emails',
  ]),
  vendor: new Set([
    'dashboard', 'bids', 'change-orders', 'documents', 'punch-list',
  ]),
}

function isWriteMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
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
    if (user && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Protected routes: redirect to login if no session
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ─── RBAC: Look up user role and enforce access ───────────────────────────

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  // If no profile exists yet (edge case during setup), allow through
  // so the setup endpoint or /api/auth/me can create/return the profile
  if (!profile) {
    return response
  }

  const role: UserRole = profile.role as UserRole

  const permKey = getPermissionKey(pathname)

  // Check if route is completely blocked for this role
  if (BLOCKED_ROUTES[role]?.has(permKey)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }
    // Redirect to dashboard with access denied flag
    return NextResponse.redirect(new URL('/?access_denied=1', request.url))
  }

  // Check if write operations are blocked (read-only routes)
  if (isWriteMethod(request.method) && pathname.startsWith('/api/') && READ_ONLY_ROUTES[role]?.has(permKey)) {
    return NextResponse.json(
      { success: false, error: 'Write access denied — read-only for your role' },
      { status: 403 }
    )
  }

  // Pass role to downstream via request headers (readable by API routes/server components)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-role', role)
  requestHeaders.set('x-user-id', user.id)

  const finalResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Preserve refreshed Supabase auth cookies from the session refresh
  response.cookies.getAll().forEach(cookie => {
    finalResponse.cookies.set(cookie.name, cookie.value, cookie)
  })

  return finalResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image).*)',
  ],
}
