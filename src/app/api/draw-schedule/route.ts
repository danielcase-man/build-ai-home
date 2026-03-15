import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import { getDrawSchedule, getDrawSummary, createDraw, updateDrawStatus } from '@/lib/draw-schedule-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return successResponse({ draws: [] })

    const { searchParams } = request.nextUrl
    if (searchParams.get('view') === 'summary') {
      const summary = await getDrawSummary(project.id)
      return successResponse(summary)
    }

    const draws = await getDrawSchedule(project.id)
    return successResponse({ count: draws.length, draws })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch draw schedule')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()
    if (!body.amount) return validationError('Missing required field: amount')

    const draw = await createDraw({
      project_id: project.id,
      loan_id: body.loan_id || null,
      milestone_id: body.milestone_id || null,
      milestone_name: body.milestone_name || null,
      amount: body.amount,
      status: body.status || 'pending',
      request_date: body.request_date || null,
      inspection_date: null,
      approval_date: null,
      funded_date: null,
      retention_amount: body.retention_amount || null,
      inspector_name: null,
      inspector_notes: null,
      notes: body.notes || null,
    })

    if (!draw) return errorResponse(new Error('Insert failed'), 'Failed to create draw')
    return successResponse({ draw })
  } catch (error) {
    return errorResponse(error, 'Failed to create draw')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.id || !body.status) return validationError('Missing id or status')

    const success = await updateDrawStatus(body.id, body.status, body)
    return successResponse({ success })
  } catch (error) {
    return errorResponse(error, 'Failed to update draw')
  }
}
