import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { env } from '@/lib/env'

/**
 * POST /api/auth/setup
 *
 * One-time setup endpoint to create the owner account.
 * Requires the service role key (only available server-side).
 * Creates the auth user + user_profile + project_member records.
 *
 * This is protected by requiring a secret in the request body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Require the cron secret as a safety check
    if (!env.cronSecret || body.secret !== env.cronSecret) {
      return errorResponse(new Error('Unauthorized'), 'Invalid secret')
    }

    if (!body.email || !body.password) {
      return errorResponse(new Error('Missing fields'), 'Email and password required')
    }

    const serviceRoleKey = env.supabaseServiceRoleKey
    if (!serviceRoleKey) {
      return errorResponse(new Error('Missing config'), 'SUPABASE_SERVICE_ROLE_KEY not configured')
    }

    // Use service role client to create auth user
    const adminClient = createClient(env.supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existing = existingUsers?.users?.find(u => u.email === body.email)

    let userId: string

    if (existing) {
      userId = existing.id
      // Update password for existing user (e.g., after password compromise)
      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
        password: body.password,
      })
      if (updateError) {
        console.error('Password update error:', updateError)
      }
    } else {
      // Create auth user with confirmed email
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
      })

      if (createError || !newUser.user) {
        return errorResponse(createError || new Error('Create failed'), 'Failed to create auth user')
      }
      userId = newUser.user.id
    }

    // Upsert user_profile
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .upsert({
        auth_user_id: userId,
        email: body.email,
        display_name: body.display_name || body.email.split('@')[0],
        role: 'owner',
        is_active: true,
      }, { onConflict: 'email' })

    if (profileError) {
      console.error('Profile upsert error:', profileError)
    }

    // Get the user_profile id
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('id')
      .eq('email', body.email)
      .single()

    // Get the project id
    const { data: project } = await adminClient
      .from('projects')
      .select('id')
      .limit(1)
      .single()

    // Create project_member if both exist
    if (profile && project) {
      await adminClient
        .from('project_members')
        .upsert({
          project_id: project.id,
          user_profile_id: profile.id,
          role: 'owner',
          permissions: { all: true },
        }, { onConflict: 'project_id,user_profile_id' })
    }

    return successResponse({
      message: existing ? 'Owner account already existed, profile updated' : 'Owner account created',
      user_id: userId,
      profile_id: profile?.id,
      project_id: project?.id,
    })
  } catch (error) {
    return errorResponse(error, 'Setup failed')
  }
}
