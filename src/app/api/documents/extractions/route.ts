import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import {
  getExtractions,
  getRoomSchedule,
  getFixtureSummary,
  markExtractionReviewed,
  createSelectionsFromTakeoff,
  createBudgetItemsFromTakeoff,
} from '@/lib/plan-takeoff-service'
import type { ExtractionType } from '@/lib/plan-takeoff-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) {
      return successResponse({ extractions: [], rooms: [] })
    }

    const { searchParams } = request.nextUrl
    const documentId = searchParams.get('document_id') || undefined
    const type = (searchParams.get('type') || undefined) as ExtractionType | undefined
    const view = searchParams.get('view')

    if (view === 'rooms') {
      const rooms = await getRoomSchedule(project.id)
      return successResponse({ count: rooms.length, rooms })
    }

    if (view === 'fixtures') {
      const fixtures = await getFixtureSummary(project.id)
      return successResponse(fixtures)
    }

    const extractions = await getExtractions(project.id, { documentId, type })
    return successResponse({
      count: extractions.length,
      extractions: extractions.map(e => ({
        id: e.id,
        document_id: e.document_id,
        extraction_type: e.extraction_type,
        extracted_data: e.extracted_data,
        confidence: e.confidence,
        ai_notes: e.ai_notes,
        reviewed: e.reviewed,
      })),
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch extractions')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.action === 'review') {
      if (!body.extraction_id) {
        return validationError('Missing extraction_id')
      }
      const success = await markExtractionReviewed(body.extraction_id)
      return successResponse({ success })
    }

    if (body.action === 'create_selections') {
      const project = await getProject()
      if (!project) return errorResponse(new Error('No project'), 'No project found')
      if (!body.extraction_id) return validationError('Missing extraction_id')

      const result = await createSelectionsFromTakeoff(project.id, body.extraction_id)
      return successResponse(result)
    }

    if (body.action === 'create_budget_items') {
      const project = await getProject()
      if (!project) return errorResponse(new Error('No project'), 'No project found')
      if (!body.extraction_id) return validationError('Missing extraction_id')

      const result = await createBudgetItemsFromTakeoff(project.id, body.extraction_id)
      return successResponse(result)
    }

    return validationError('Invalid action. Use: review, create_selections, create_budget_items')
  } catch (error) {
    return errorResponse(error, 'Failed to update extraction')
  }
}
