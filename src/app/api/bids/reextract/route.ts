/**
 * POST /api/bids/reextract
 *
 * Re-extract bid line items from source documents (Phase 2 coverage pipeline).
 *
 * Body:
 *   { bid_id: string }        — re-extract a single bid
 *   { all: true }             — normalize JSONB + re-extract all bids without line items
 *
 * Auth: Bearer token (CRON_SECRET) or dev mode.
 */

import { NextRequest } from 'next/server'
import { normalizeExistingLineItems, reextractBid, reextractAllBids } from '@/lib/bid-reextraction-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { env } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    // Auth: accept cron secret OR allow in dev mode
    const authHeader = request.headers.get('authorization')
    const isAuthed = env.cronSecret && authHeader === `Bearer ${env.cronSecret}`
    const isDev = process.env.NODE_ENV === 'development'

    if (!isAuthed && !isDev) {
      return errorResponse(new Error('Unauthorized'), 'Unauthorized')
    }

    const body = await request.json() as { bid_id?: string; all?: boolean }

    if (body.bid_id) {
      // Single bid re-extraction
      const result = await reextractBid(body.bid_id)
      if (result.error) {
        return errorResponse(new Error(result.error), result.error)
      }
      return successResponse({
        bid_id: body.bid_id,
        line_items_created: result.lineItems,
        message: `Re-extracted ${result.lineItems} line items`,
      })
    }

    if (body.all) {
      // Full normalization + re-extraction
      const project = await getProject()
      if (!project) return errorResponse(new Error('No project'), 'No project found')

      // Step 1: Normalize existing JSONB line items
      const normalizeResult = await normalizeExistingLineItems(project.id)

      // Step 2: Re-extract bids that still have no line items
      const reextractResult = await reextractAllBids(project.id)

      return successResponse({
        normalize: normalizeResult,
        reextract: reextractResult,
        message: `Normalized ${normalizeResult.normalized} bids, re-extracted ${reextractResult.succeeded}/${reextractResult.total} bids`,
      })
    }

    return validationError('Provide either bid_id or all: true')
  } catch (error) {
    return errorResponse(error, 'Bid re-extraction failed')
  }
}
