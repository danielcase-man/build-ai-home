import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import { getInspections, scheduleInspection, recordInspectionResult, createFromInspection } from '@/lib/punch-list-service'
import type { InspectionStatus } from '@/lib/punch-list-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return successResponse({ inspections: [] })

    const { searchParams } = request.nextUrl
    const status = (searchParams.get('status') || undefined) as InspectionStatus | undefined

    const inspections = await getInspections(project.id, { status })
    return successResponse({ count: inspections.length, inspections })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch inspections')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()
    if (!body.inspection_type) return validationError('Missing inspection_type')

    const inspection = await scheduleInspection({
      project_id: project.id,
      inspection_type: body.inspection_type,
      knowledge_id: body.knowledge_id || null,
      permit_id: body.permit_id || null,
      status: body.scheduled_date ? 'scheduled' : 'not_scheduled',
      scheduled_date: body.scheduled_date || null,
      completed_date: null,
      inspector_name: body.inspector_name || null,
      deficiencies: [],
      photos: [],
      notes: body.notes || null,
    })

    if (!inspection) return errorResponse(new Error('Insert failed'), 'Failed to schedule inspection')
    return successResponse({ inspection })
  } catch (error) {
    return errorResponse(error, 'Failed to schedule inspection')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()
    if (!body.id) return validationError('Missing id')

    if (body.action === 'record_result') {
      const success = await recordInspectionResult(body.id, {
        status: body.status,
        inspector_name: body.inspector_name,
        deficiencies: body.deficiencies,
        photos: body.photos,
        notes: body.notes,
      })

      // Auto-create punch items from failed inspection deficiencies
      if (success && body.status === 'failed' && body.deficiencies?.length > 0) {
        await createFromInspection(project.id, body.id, body.deficiencies)
      }

      return successResponse({ success })
    }

    return validationError('Invalid action. Use record_result.')
  } catch (error) {
    return errorResponse(error, 'Failed to update inspection')
  }
}
