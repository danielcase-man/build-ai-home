import { NextRequest } from 'next/server'
import { extractBidFromFile } from '@/lib/bid-ingestion-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

/**
 * POST /api/bids/upload
 * Multipart form upload of a bid document (PDF, image, doc).
 * AI extracts vendor info, line items, pricing automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const vendorName = formData.get('vendor_name') as string | null

    if (!file) {
      return errorResponse(new Error('No file'), 'File is required')
    }

    // Size limit: 20MB
    if (file.size > 20 * 1024 * 1024) {
      return errorResponse(new Error('File too large'), 'File must be under 20MB')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await extractBidFromFile(
      project.id,
      buffer,
      file.name,
      file.type || 'application/octet-stream',
      vendorName || undefined
    )

    if (!result || !result.bidId) {
      return errorResponse(
        new Error(result?.error || 'Extraction failed'),
        result?.error || 'Could not extract bid from document'
      )
    }

    return successResponse({
      bid_id: result.bidId,
      line_items_created: result.lineItemCount,
      message: `Extracted ${result.lineItemCount} line items from ${file.name}`,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to upload and extract bid')
  }
}
