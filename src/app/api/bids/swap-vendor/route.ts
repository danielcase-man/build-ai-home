import { NextRequest } from 'next/server'
import { swapVendor } from '@/lib/vendor-selection-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

/**
 * POST /api/bids/swap-vendor
 * Body: { category: string, new_bid_id: string }
 * Swaps the selected vendor for a category.
 */
export async function POST(request: NextRequest) {
  try {
    const { category, new_bid_id } = await request.json()
    if (!category || !new_bid_id) return validationError('category and new_bid_id required')

    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const result = await swapVendor(project.id, category, new_bid_id)

    if (result.error) {
      return errorResponse(new Error(result.error), result.error)
    }

    return successResponse({
      message: `Vendor swapped — ${result.selections_created} new selections created`,
      selections_created: result.selections_created,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to swap vendor')
  }
}
