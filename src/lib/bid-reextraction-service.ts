/**
 * Bid Re-Extraction Service — Phase 2 of the Coverage Pipeline.
 *
 * Two operations:
 *   1. normalizeExistingLineItems() — convert v1 JSONB line_items into bid_line_items rows
 *   2. reextractBid() / reextractAllBids() — re-read PDFs and extract fresh line items
 *
 * This populates the bid_line_items table so that Phase 3 (matching) can compare
 * bid line items against takeoff items for coverage scoring.
 */

import { supabase } from './supabase'
import { createLineItemsFromExtraction, deleteLineItemsForBid } from './bid-line-items-service'
import { extractBidV2FromText } from './bid-ingestion-service'
import { extractTextFromPDF } from './document-analyzer'
import { readFileSync } from 'fs'
import type { LineItem, ExtractedLineItem } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface NormalizeResult {
  normalized: number
  skipped: number
  errors: string[]
}

interface ReextractBidResult {
  lineItems: number
  error?: string
}

interface ReextractAllResult {
  total: number
  succeeded: number
  failed: number
  errors: string[]
}

// ─── V1 JSONB → bid_line_items normalization ────────────────────────────────

/**
 * Convert v1 JSONB line_items on bids into normalized bid_line_items rows.
 * Only processes bids that have JSONB data but 0 rows in bid_line_items.
 */
export async function normalizeExistingLineItems(
  projectId: string
): Promise<NormalizeResult> {
  const result: NormalizeResult = { normalized: 0, skipped: 0, errors: [] }

  // Step 1: Get all bids with non-null line_items JSONB
  const { data: bidsWithJsonb, error: bidsErr } = await supabase
    .from('bids')
    .select('id, category, vendor_name, line_items')
    .eq('project_id', projectId)
    .not('line_items', 'is', null)

  if (bidsErr || !bidsWithJsonb) {
    result.errors.push(`Failed to query bids: ${bidsErr?.message || 'no data'}`)
    return result
  }

  // Filter out bids with empty arrays
  const bidsWithData = bidsWithJsonb.filter((b: Record<string, unknown>) => {
    const items = b.line_items as unknown[]
    return Array.isArray(items) && items.length > 0
  })

  if (bidsWithData.length === 0) return result

  // Step 2: Get all bid_ids that already have bid_line_items
  const { data: existingRows } = await supabase
    .from('bid_line_items')
    .select('bid_id')

  const bidsWithLineItems = new Set<string>()
  if (existingRows) {
    for (const row of existingRows) {
      bidsWithLineItems.add(row.bid_id as string)
    }
  }

  // Step 3: Process bids that need normalization
  for (const bid of bidsWithData) {
    const bidId = bid.id as string
    if (bidsWithLineItems.has(bidId)) {
      result.skipped++
      continue
    }

    try {
      const items = bid.line_items as LineItem[]
      const category = bid.category as string

      const mapped: ExtractedLineItem[] = items.map((item) => ({
        item_name: item.item || 'Unknown Item',
        item_description: item.specs || undefined,
        quantity: item.quantity || 1,
        unit: 'EA',
        unit_price: item.unit_price || undefined,
        total_price: item.total || 0,
        specs: item.specs || undefined,
        notes: item.notes || undefined,
        category: category,
      }))

      const created = await createLineItemsFromExtraction(bidId, mapped, category)
      if (created.length > 0) {
        result.normalized++
      } else {
        result.errors.push(`Bid ${bidId}: createLineItemsFromExtraction returned 0 rows`)
      }
    } catch (err) {
      result.errors.push(`Bid ${bidId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return result
}

// ─── Single-bid PDF re-extraction ───────────────────────────────────────────

/**
 * Re-extract line items for a single bid by reading its source PDF.
 * Looks up the bid_documents record or falls back to file_inventory.
 */
export async function reextractBid(bidId: string): Promise<ReextractBidResult> {
  // Get the bid record
  const { data: bid, error: bidErr } = await supabase
    .from('bids')
    .select('id, category, vendor_name, project_id')
    .eq('id', bidId)
    .single()

  if (bidErr || !bid) {
    return { lineItems: 0, error: `Bid not found: ${bidErr?.message || 'no data'}` }
  }

  // Try to find the document path
  const filePath = await findDocumentPath(bidId, bid.vendor_name as string, bid.category as string)
  if (!filePath) {
    return { lineItems: 0, error: 'No document found for this bid' }
  }

  // Read the PDF
  let buffer: Buffer
  try {
    buffer = readFileSync(filePath)
  } catch (err) {
    return { lineItems: 0, error: `Could not read file: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }

  // Extract text
  const text = await extractTextFromPDF(buffer)
  if (!text || text.trim().length < 50) {
    return { lineItems: 0, error: 'PDF has no extractable text' }
  }

  // AI extraction
  const extraction = await extractBidV2FromText(text, {
    vendorName: bid.vendor_name as string,
    filename: filePath.split('/').pop() || filePath.split('\\').pop() || 'document.pdf',
    sourceType: 'reextraction',
  })

  if (!extraction.bid || !extraction.bid.line_items_v2) {
    return { lineItems: 0, error: extraction.error || 'AI extraction returned no line items' }
  }

  // Delete existing line items and create new ones
  await deleteLineItemsForBid(bidId)
  const created = await createLineItemsFromExtraction(
    bidId,
    extraction.bid.line_items_v2,
    bid.category as string
  )

  return { lineItems: created.length }
}

/**
 * Look up the source PDF path for a bid:
 * 1. Check bid_documents for dropbox_path or storage_path
 * 2. Fall back to file_inventory matching vendor + category
 */
async function findDocumentPath(
  bidId: string,
  vendorName: string,
  category: string
): Promise<string | null> {
  // Check bid_documents first
  const { data: docs } = await supabase
    .from('bid_documents')
    .select('dropbox_path, storage_path')
    .eq('bid_id', bidId)
    .limit(1)

  if (docs && docs.length > 0) {
    const doc = docs[0]
    if (doc.dropbox_path) return doc.dropbox_path as string
    if (doc.storage_path) return doc.storage_path as string
  }

  // Fall back to file_inventory — match by vendor name + category in file path
  const vendorLower = vendorName.toLowerCase()
  const { data: files } = await supabase
    .from('file_inventory')
    .select('file_path')
    .eq('file_type', 'pdf')
    .eq('processing_status', 'completed')
    .ilike('file_path', `%${vendorLower}%`)
    .limit(5)

  if (files && files.length > 0) {
    // Prefer files whose path also matches the category
    const categoryLower = category.toLowerCase()
    const match = files.find((f: Record<string, unknown>) =>
      (f.file_path as string).toLowerCase().includes(categoryLower)
    )
    return (match?.file_path || files[0].file_path) as string
  }

  return null
}

// ─── Batch re-extraction ────────────────────────────────────────────────────

/**
 * Re-extract all bids that have 0 line items in bid_line_items.
 * Runs normalizeExistingLineItems first, then re-extracts from PDFs.
 */
export async function reextractAllBids(
  projectId: string,
  options?: { concurrency?: number }
): Promise<ReextractAllResult> {
  const concurrency = options?.concurrency || 3
  const result: ReextractAllResult = { total: 0, succeeded: 0, failed: 0, errors: [] }

  // Get all bids for the project
  const { data: allBids } = await supabase
    .from('bids')
    .select('id')
    .eq('project_id', projectId)

  if (!allBids || allBids.length === 0) return result

  // Get bid_ids that already have line items
  const { data: existingRows } = await supabase
    .from('bid_line_items')
    .select('bid_id')

  const bidsWithLineItems = new Set<string>()
  if (existingRows) {
    for (const row of existingRows) {
      bidsWithLineItems.add(row.bid_id as string)
    }
  }

  // Filter to bids without line items
  const bidsToProcess = allBids.filter(
    (b: Record<string, unknown>) => !bidsWithLineItems.has(b.id as string)
  )
  result.total = bidsToProcess.length

  if (bidsToProcess.length === 0) return result

  // Process in batches
  for (let i = 0; i < bidsToProcess.length; i += concurrency) {
    const batch = bidsToProcess.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map((b: Record<string, unknown>) => reextractBid(b.id as string))
    )

    for (const batchResult of batchResults) {
      if (batchResult.status === 'fulfilled') {
        if (batchResult.value.lineItems > 0) {
          result.succeeded++
        } else {
          result.failed++
          if (batchResult.value.error) {
            result.errors.push(batchResult.value.error)
          }
        }
      } else {
        result.failed++
        result.errors.push(batchResult.reason?.message || 'Unknown error')
      }
    }
  }

  return result
}
