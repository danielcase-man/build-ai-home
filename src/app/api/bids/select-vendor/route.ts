import { NextRequest } from 'next/server'
import { selectVendorForCategory } from '@/lib/vendor-selection-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

/**
 * POST /api/bids/select-vendor
 * Body: { bid_id: string }
 * Selects a vendor's bid: creates selections from their line items,
 * rejects competing bids, marks old selections as alternatives.
 */
export async function POST(request: NextRequest) {
  try {
    const { bid_id } = await request.json()
    if (!bid_id) return validationError('bid_id required')

    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const result = await selectVendorForCategory(project.id, bid_id)

    if (result.error) {
      return errorResponse(new Error(result.error), result.error)
    }

    return successResponse({
      message: `Vendor selected — ${result.selections_created} selections created`,
      selections_created: result.selections_created,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to select vendor')
  }
}
