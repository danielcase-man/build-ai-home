import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getInvitationByToken, acceptInvitation } from '@/lib/vendor-invitation-service'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) return validationError('Missing token')

    const invitation = await getInvitationByToken(token)
    if (!invitation) {
      return errorResponse(new Error('Invitation not found or expired'), 'Invitation not found or expired')
    }

    const [vendorResult, projectResult] = await Promise.all([
      supabase.from('vendors').select('company_name, category').eq('id', invitation.vendor_id).single(),
      supabase.from('projects').select('address, phase').eq('id', invitation.project_id).single(),
    ])

    return successResponse({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expires_at: invitation.expires_at,
        accepted_at: invitation.accepted_at,
      },
      vendor: vendorResult.data ? {
        company_name: vendorResult.data.company_name,
        category: vendorResult.data.category,
      } : null,
      project: projectResult.data ? {
        address: projectResult.data.address,
        phase: projectResult.data.phase,
      } : null,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to validate invitation')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.token) return validationError('Missing token')
    if (!body.password || body.password.length < 8) {
      return validationError('Password must be at least 8 characters')
    }

    const invitation = await getInvitationByToken(body.token)
    if (!invitation) {
      return errorResponse(new Error('Invitation not found or expired'), 'Invitation not found or expired')
    }

    if (invitation.accepted_at) {
      return successResponse({ message: 'Already accepted', already_accepted: true })
    }

    // Create auth user via service role (if available) or regular signup
    const serviceRoleKey = env.supabaseServiceRoleKey
    let userId: string | null = null

    if (serviceRoleKey) {
      // Admin API — creates confirmed user directly
      const adminClient = createClient(env.supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { display_name: body.display_name || invitation.email.split('@')[0] },
      })

      if (authError) {
        // User might already exist — try to find them
        if (authError.message.includes('already been registered')) {
          const { data: users } = await adminClient.auth.admin.listUsers()
          const existing = users?.users?.find(u => u.email === invitation.email)
          userId = existing?.id || null
        } else {
          return errorResponse(authError, 'Failed to create account')
        }
      } else {
        userId = authData.user?.id || null
      }

      // Create user_profile
      if (userId) {
        await adminClient.from('user_profiles').upsert({
          auth_user_id: userId,
          email: invitation.email,
          display_name: body.display_name || invitation.email.split('@')[0],
          role: invitation.role || 'vendor',
          vendor_id: invitation.vendor_id,
          is_active: true,
        }, { onConflict: 'email' })

        // Get profile id and create project_member
        const { data: profile } = await adminClient
          .from('user_profiles')
          .select('id')
          .eq('email', invitation.email)
          .single()

        if (profile) {
          await adminClient.from('project_members').upsert({
            project_id: invitation.project_id,
            user_profile_id: profile.id,
            role: invitation.role || 'vendor',
            permissions: { read: true },
          }, { onConflict: 'project_id,user_profile_id' })
        }
      }
    } else {
      // Fallback: use regular signUp (user will need to confirm email)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: body.password,
        options: {
          data: { display_name: body.display_name || invitation.email.split('@')[0] },
        },
      })

      if (signUpError) {
        return errorResponse(signUpError, 'Failed to create account')
      }
      userId = signUpData.user?.id || null
    }

    // Mark invitation as accepted
    await acceptInvitation(body.token)

    return successResponse({
      message: 'Account created and invitation accepted',
      accepted: true,
      user_id: userId,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to accept invitation')
  }
}
