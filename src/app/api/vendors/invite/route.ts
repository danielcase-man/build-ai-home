import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import {
  createVendorInvitation,
  getVendorInvitations,
  revokeInvitation,
} from '@/lib/vendor-invitation-service'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) return successResponse({ invitations: [] })

    const invitations = await getVendorInvitations(project.id)
    return successResponse({ count: invitations.length, invitations })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch invitations')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()
    const role = body.role || 'vendor'

    // Vendor invitations require vendor_id; consultant invitations don't
    if (role === 'vendor' && !body.vendor_id) {
      return validationError('Missing required field: vendor_id')
    }
    if (!body.email) {
      return validationError('Missing required field: email')
    }
    if (!['vendor', 'consultant'].includes(role)) {
      return validationError('Role must be "vendor" or "consultant"')
    }

    // Basic email validation
    if (!body.email.includes('@')) {
      return validationError('Invalid email address')
    }

    const invitation = await createVendorInvitation(
      project.id,
      body.vendor_id || null,
      body.email,
      role,
    )

    if (!invitation) {
      return errorResponse(new Error('Insert failed'), 'Failed to create invitation')
    }

    return successResponse({ invitation }, 201)
  } catch (error) {
    return errorResponse(error, 'Failed to create invitation')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.id) return validationError('Missing invitation id')

    const success = await revokeInvitation(body.id)
    return successResponse({ success })
  } catch (error) {
    return errorResponse(error, 'Failed to revoke invitation')
  }
}
