import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { env } from '@/lib/env'

/**
 * POST /api/auth/register
 *
 * Called after client-side supabase.auth.signUp() succeeds.
 * Creates the user_profile and project_member records using the service role client.
 *
 * Body: { auth_user_id, email, display_name }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { auth_user_id, email, display_name } = body

    if (!auth_user_id || !email) {
      return validationError('auth_user_id and email required')
    }

    const serviceRoleKey = env.supabaseServiceRoleKey
    if (!serviceRoleKey) {
      return errorResponse(new Error('Missing config'), 'Server configuration error')
    }

    const adminClient = createClient(env.supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Check if an owner already exists — first user becomes owner
    const { count } = await adminClient
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'owner')

    const role = (count ?? 0) === 0 ? 'owner' : 'viewer'

    // Create user_profile
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .upsert({
        auth_user_id,
        email,
        display_name: display_name || email.split('@')[0],
        role,
        is_active: true,
      }, { onConflict: 'email' })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      return errorResponse(profileError, 'Failed to create user profile')
    }

    // Get the profile ID and project ID to create membership
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .single()

    const { data: project } = await adminClient
      .from('projects')
      .select('id')
      .limit(1)
      .single()

    if (profile && project) {
      await adminClient
        .from('project_members')
        .upsert({
          project_id: project.id,
          user_profile_id: profile.id,
          role,
          permissions: role === 'owner' ? { all: true } : {},
        }, { onConflict: 'project_id,user_profile_id' })
    }

    return successResponse({
      message: 'Account created',
      role,
    })
  } catch (error) {
    return errorResponse(error, 'Registration failed')
  }
}
