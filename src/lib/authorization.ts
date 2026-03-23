/**
 * Authorization — role-based access control for FrameWork.
 *
 * Three roles:
 *   owner      — full read/write access to everything
 *   consultant — read-only access, no financial details (loan, payments, transactions)
 *   vendor     — scoped to own bids, docs, and communications only
 */

import { createAuthServerClient } from './supabase-auth-server'
import { NextResponse } from 'next/server'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'consultant' | 'vendor'

export interface UserProfile {
  id: string
  auth_user_id: string
  email: string
  display_name: string
  role: UserRole
  vendor_id: string | null
  is_active: boolean
}

export interface ProjectMembership {
  project_id: string
  role: UserRole
  permissions: Record<string, boolean>
}

export interface AuthContext {
  user: { id: string; email?: string }
  profile: UserProfile
  membership: ProjectMembership | null
}

// ─── Permission Matrix ──────────────────────────────────────────────────────────

/**
 * Routes/features each role can access.
 * 'read' = GET only, 'write' = GET + POST/PATCH/DELETE, 'none' = no access
 */
type AccessLevel = 'write' | 'read' | 'none'

const PERMISSION_MATRIX: Record<string, Record<UserRole, AccessLevel>> = {
  // Overview
  dashboard:       { owner: 'write', consultant: 'read',  vendor: 'read'  },
  'project-status':{ owner: 'write', consultant: 'read',  vendor: 'none'  },
  assistant:       { owner: 'write', consultant: 'read',  vendor: 'none'  },
  timeline:        { owner: 'write', consultant: 'read',  vendor: 'none'  },
  workflow:        { owner: 'write', consultant: 'read',  vendor: 'none'  },

  // Communications
  emails:          { owner: 'write', consultant: 'read',  vendor: 'none'  },

  // Financial — hidden from consultant and vendor
  budget:          { owner: 'write', consultant: 'none',  vendor: 'none'  },
  financing:       { owner: 'write', consultant: 'none',  vendor: 'none'  },
  payments:        { owner: 'write', consultant: 'none',  vendor: 'none'  },
  transactions:    { owner: 'write', consultant: 'none',  vendor: 'none'  },

  // Bids — vendor sees only own bids
  bids:            { owner: 'write', consultant: 'read',  vendor: 'read'  },

  // Selections & Coverage — consultant can view
  selections:      { owner: 'write', consultant: 'read',  vendor: 'none'  },
  coverage:        { owner: 'write', consultant: 'read',  vendor: 'none'  },

  // Construction
  'change-orders': { owner: 'write', consultant: 'read',  vendor: 'read'  },
  vendors:         { owner: 'write', consultant: 'read',  vendor: 'none'  },
  documents:       { owner: 'write', consultant: 'read',  vendor: 'read'  },
  'punch-list':    { owner: 'write', consultant: 'read',  vendor: 'read'  },
  warranties:      { owner: 'write', consultant: 'read',  vendor: 'none'  },
  audit:           { owner: 'read',  consultant: 'none',  vendor: 'none'  },

  // Admin
  'vendor-invite': { owner: 'write', consultant: 'none',  vendor: 'none'  },
  'admin':         { owner: 'write', consultant: 'none',  vendor: 'none'  },
}

// ─── Route → permission key mapping ─────────────────────────────────────────────

/** Map a URL path to a permission key */
export function routeToPermissionKey(pathname: string): string {
  // Strip leading slash, take first segment
  const segments = pathname.replace(/^\//, '').split('/')

  // API routes: /api/financing/... → financing
  if (segments[0] === 'api') {
    const apiSegment = segments[1]
    // Map API route names to permission keys
    const apiMapping: Record<string, string> = {
      'bids': 'bids',
      'financing': 'financing',
      'payments': 'payments',
      'transactions': 'transactions',
      'selections': 'selections',
      'emails': 'emails',
      'project-status': 'project-status',
      'budget': 'budget',
      'change-orders': 'change-orders',
      'vendors': 'vendors',
      'documents': 'documents',
      'punch-list': 'punch-list',
      'warranties': 'warranties',
      'audit': 'audit',
      'assistant': 'assistant',
      'workflow': 'workflow',
      'search': 'dashboard',
      'notifications': 'dashboard',
      'knowledge': 'workflow',
      'research': 'assistant',
      'export': 'budget',
      'upload': 'documents',
      'photos': 'documents',
      'inspections': 'punch-list',
      'contracts': 'payments',
      'invoices': 'payments',
      'draw-schedule': 'financing',
      'vendor-threads': 'vendors',
      'email-templates': 'emails',
      'plaid': 'financing',
      'jobtread': 'admin',
      'admin': 'admin',
      'auth': 'dashboard', // auth endpoints are always allowed (handled by middleware)
      'cron': 'admin',
      'gmail': 'emails',
    }
    return apiMapping[apiSegment] || 'dashboard'
  }

  // Page routes
  const pageSegment = segments[0] || 'dashboard'
  if (pageSegment === '') return 'dashboard'
  return pageSegment
}

// ─── Core Auth Functions ────────────────────────────────────────────────────────

/**
 * Get the current authenticated user's full auth context.
 * Returns null if not authenticated.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createAuthServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || !profile.is_active) return null

  // Get project membership (maybeSingle: user may not have membership yet during setup)
  const { data: membership } = await supabase
    .from('project_members')
    .select('project_id, role, permissions')
    .eq('user_profile_id', profile.id)
    .limit(1)
    .maybeSingle()

  return {
    user: { id: user.id, email: user.email },
    profile: profile as UserProfile,
    membership: membership as ProjectMembership | null,
  }
}

/**
 * Check if a role has access to a given permission key.
 */
export function checkAccess(role: UserRole, permissionKey: string): AccessLevel {
  return PERMISSION_MATRIX[permissionKey]?.[role] ?? 'none'
}

/**
 * Check if a role can read a given feature.
 */
export function canRead(role: UserRole, permissionKey: string): boolean {
  const level = checkAccess(role, permissionKey)
  return level === 'read' || level === 'write'
}

/**
 * Check if a role can write to a given feature.
 */
export function canWrite(role: UserRole, permissionKey: string): boolean {
  return checkAccess(role, permissionKey) === 'write'
}

/**
 * Get all nav items a role can see (for sidebar filtering).
 */
export function getVisibleNavKeys(role: UserRole): string[] {
  return Object.entries(PERMISSION_MATRIX)
    .filter(([, perms]) => perms[role] !== 'none')
    .map(([key]) => key)
}

// ─── API Route Helpers ──────────────────────────────────────────────────────────

/**
 * Require authentication for an API route. Returns the auth context
 * or a 401 response if not authenticated.
 */
export async function requireAuth(): Promise<
  { auth: AuthContext; error?: never } | { auth?: never; error: NextResponse }
> {
  const auth = await getAuthContext()
  if (!auth) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }
  return { auth }
}

/**
 * Require a specific access level for a permission key.
 * Returns the auth context or an error response.
 */
export async function requireAccess(
  permissionKey: string,
  level: 'read' | 'write' = 'read',
): Promise<
  { auth: AuthContext; error?: never } | { auth?: never; error: NextResponse }
> {
  const result = await requireAuth()
  if (result.error) return result

  const { auth } = result
  const role = (auth.membership?.role || auth.profile.role) as UserRole
  const access = checkAccess(role, permissionKey)

  if (access === 'none') {
    return {
      error: NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      ),
    }
  }

  if (level === 'write' && access !== 'write') {
    return {
      error: NextResponse.json(
        { success: false, error: 'Write access denied — read-only for your role' },
        { status: 403 }
      ),
    }
  }

  return { auth }
}

/**
 * For vendor-scoped routes: returns the vendor_id the user is scoped to,
 * or null if the user is owner/consultant (unrestricted).
 */
export function getVendorScope(auth: AuthContext): string | null {
  const role = (auth.membership?.role || auth.profile.role) as UserRole
  if (role === 'vendor') {
    return auth.profile.vendor_id
  }
  return null // owner and consultant see all (consultant filtered by permission, not vendor scope)
}
