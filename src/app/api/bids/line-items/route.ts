import { NextRequest } from 'next/server'
import { getBidLineItems, createLineItemsFromExtraction, deleteLineItemsForBid } from '@/lib/bid-line-items-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

/**
 * GET /api/bids/line-items?bidId=xxx
 * Returns line items for a specific bid.
 */
export async function GET(request: NextRequest) {
  try {
    const bidId = request.nextUrl.searchParams.get('bidId')
    if (!bidId) return validationError('bidId required')

    const items = await getBidLineItems(bidId)
    return successResponse({ items })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch line items')
  }
}

/**
 * POST /api/bids/line-items
 * Body: { bid_id: string, items: ExtractedLineItem[], category?: string }
 * Creates line items from extraction results or manual entry.
 */
export async function POST(request: NextRequest) {
  try {
    const { bid_id, items, category } = await request.json()
    if (!bid_id || !items?.length) return validationError('bid_id and items required')

    const created = await createLineItemsFromExtraction(bid_id, items, category)
    return successResponse({ items: created, count: created.length })
  } catch (error) {
    return errorResponse(error, 'Failed to create line items')
  }
}

/**
 * DELETE /api/bids/line-items
 * Body: { bid_id: string }
 * Deletes all line items for a bid (used before re-extraction).
 */
export async function DELETE(request: NextRequest) {
  try {
    const { bid_id } = await request.json()
    if (!bid_id) return validationError('bid_id required')

    await deleteLineItemsForBid(bid_id)
    return successResponse({ message: 'Line items deleted' })
  } catch (error) {
    return errorResponse(error, 'Failed to delete line items')
  }
}
