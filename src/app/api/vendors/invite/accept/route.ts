import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getInvitationByToken, acceptInvitation } from '@/lib/vendor-invitation-service'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) return validationError('Missing token')

    const invitation = await getInvitationByToken(token)
    if (!invitation) {
      return errorResponse(new Error('Invitation not found or expired'), 'Invitation not found or expired')
    }

    // Get vendor and project info for the landing page
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

    const invitation = await getInvitationByToken(body.token)
    if (!invitation) {
      return errorResponse(new Error('Invitation not found or expired'), 'Invitation not found or expired')
    }

    if (invitation.accepted_at) {
      return successResponse({ message: 'Already accepted', already_accepted: true })
    }

    const success = await acceptInvitation(body.token)
    if (!success) {
      return errorResponse(new Error('Accept failed'), 'Failed to accept invitation')
    }

    return successResponse({ message: 'Invitation accepted', accepted: true })
  } catch (error) {
    return errorResponse(error, 'Failed to accept invitation')
  }
}
