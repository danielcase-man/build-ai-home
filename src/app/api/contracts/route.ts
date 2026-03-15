import { NextRequest } from 'next/server'
import { getContracts, upsertContract } from '@/lib/financial-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const contracts = await getContracts(project.id)
    return successResponse({ contracts })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch contracts')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, total_amount, vendor_id, bid_id, budget_item_id, description, payment_terms, start_date, end_date, status, notes } = body

    if (!title || total_amount === undefined) {
      return validationError('title and total_amount are required')
    }

    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const contract = await upsertContract({
      project_id: project.id,
      title,
      total_amount,
      vendor_id,
      bid_id,
      budget_item_id,
      description,
      payment_terms,
      start_date,
      end_date,
      status: status || 'draft',
      notes,
    })

    return successResponse({ contract })
  } catch (error) {
    return errorResponse(error, 'Failed to save contract')
  }
}
