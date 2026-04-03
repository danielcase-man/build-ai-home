/**
 * GET /api/permits/:permitId — get a single permit
 * PATCH /api/permits/:permitId — update permit status/details
 * POST /api/permits/:permitId/inspection — add an inspection record
 */

import { NextRequest } from 'next/server'
import { getPermit, updatePermit, addInspection } from '@/lib/permits-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ permitId: string }> }
) {
  try {
    const { permitId } = await params
    const permit = await getPermit(permitId)
    if (!permit) return errorResponse(new Error('Not found'), 'Permit not found')
    return successResponse(permit)
  } catch (error) {
    return errorResponse(error, 'Failed to fetch permit')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ permitId: string }> }
) {
  try {
    const { permitId } = await params
    const body = await request.json()

    // If this is an inspection addition
    if (body.inspection) {
      const permit = await addInspection(permitId, body.inspection)
      if (!permit) return errorResponse(new Error('Failed'), 'Failed to add inspection')
      return successResponse(permit)
    }

    // Otherwise update fields
    const permit = await updatePermit(permitId, {
      status: body.status,
      permit_number: body.permit_number,
      application_date: body.application_date,
      approval_date: body.approval_date,
      expiration_date: body.expiration_date,
      notes: body.notes,
    })

    if (!permit) return errorResponse(new Error('Failed'), 'Failed to update permit')
    return successResponse(permit)
  } catch (error) {
    return errorResponse(error, 'Failed to update permit')
  }
}
