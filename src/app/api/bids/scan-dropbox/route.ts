import { NextRequest } from 'next/server'
import { processDropboxBidFiles, DropboxBidFile } from '@/lib/bid-ingestion-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

/**
 * POST /api/bids/scan-dropbox
 * Body: { files: DropboxBidFile[] }
 *
 * Processes a list of Dropbox files through the bid extraction pipeline.
 * The caller (typically the frontend or an MCP-driven workflow) is responsible
 * for listing the files from Dropbox first, then passing them here.
 *
 * Each file needs: { path, name, fileId, size }
 *
 * Files are downloaded via the Dropbox MCP get_file_content tool on the
 * client side and sent as base64, OR we fetch them server-side if a
 * Dropbox access token is available.
 */
export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()
    const files = body.files as DropboxBidFile[] | undefined
    const fileContents = body.file_contents as Record<string, string> | undefined // path -> base64

    if (!files || files.length === 0) {
      return errorResponse(new Error('No files'), 'files array required')
    }

    // Process files — content provided as base64 in the request
    const results = await processDropboxBidFiles(
      project.id,
      files,
      async (path: string) => {
        // Look up base64 content from the request body
        const b64 = fileContents?.[path]
        if (!b64) return null
        return Buffer.from(b64, 'base64')
      }
    )

    const successful = results.filter(r => r.bidId)
    const failed = results.filter(r => !r.bidId)

    return successResponse({
      message: `Processed ${files.length} files: ${successful.length} bids extracted, ${failed.length} skipped`,
      total_files: files.length,
      bids_extracted: successful.length,
      skipped: failed.length,
      results,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to scan Dropbox files')
  }
}
