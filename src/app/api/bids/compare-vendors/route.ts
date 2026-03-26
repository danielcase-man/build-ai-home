import { NextRequest } from 'next/server'
import { getVendorComparisonForCategory } from '@/lib/vendor-selection-service'
import { getVendorComparisons } from '@/lib/bid-line-items-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

/**
 * GET /api/bids/compare-vendors?category=Countertops
 * Returns vendor comparison data for a specific category,
 * or all categories if no category specified.
 */
export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const category = request.nextUrl.searchParams.get('category')

    if (category) {
      const comparison = await getVendorComparisonForCategory(project.id, category)
      return successResponse(comparison)
    }

    const comparisons = await getVendorComparisons(project.id)
    return successResponse({ categories: comparisons })
  } catch (error) {
    return errorResponse(error, 'Failed to get vendor comparisons')
  }
}
