/**
 * GET /api/permits — list all permits for the project
 * POST /api/permits — create a new permit or seed required permits
 *
 * POST body:
 *   { seed: true }  — seed required permits
 *   { type, status, ... }  — create a specific permit
 */

import { NextRequest } from 'next/server'
import { getProject } from '@/lib/project-service'
import { getPermits, createPermit, seedRequiredPermits, getPermitAlerts } from '@/lib/permits-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const permits = await getPermits(project.id)
    const alerts = getPermitAlerts(permits)

    return successResponse({ permits, alerts })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch permits')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()

    if (body.seed) {
      const result = await seedRequiredPermits(project.id)
      return successResponse(result)
    }

    const permit = await createPermit({
      project_id: project.id,
      type: body.type,
      status: body.status || 'not_started',
      permit_number: body.permit_number,
      application_date: body.application_date,
      approval_date: body.approval_date,
      expiration_date: body.expiration_date,
      notes: body.notes,
    })

    if (!permit) return errorResponse(new Error('Failed to create'), 'Failed to create permit')
    return successResponse(permit)
  } catch (error) {
    return errorResponse(error, 'Failed to create permit')
  }
}
