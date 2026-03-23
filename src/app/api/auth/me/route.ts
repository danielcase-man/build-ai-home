import { successResponse, errorResponse } from '@/lib/api-utils'
import { getAuthContext } from '@/lib/authorization'

/**
 * GET /api/auth/me — returns the current user's profile and role.
 * Used by client components to filter UI by role.
 */
export async function GET() {
  try {
    const auth = await getAuthContext()
    if (!auth) {
      return successResponse({ authenticated: false, user: null })
    }

    return successResponse({
      authenticated: true,
      user: {
        id: auth.profile.id,
        email: auth.profile.email,
        display_name: auth.profile.display_name,
        role: auth.membership?.role || auth.profile.role,
        vendor_id: auth.profile.vendor_id,
      },
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch user info')
  }
}
