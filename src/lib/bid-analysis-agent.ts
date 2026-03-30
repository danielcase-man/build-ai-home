/**
 * Bid Analysis Agent
 *
 * Domain expert agent that processes bid/quote documents from Dropbox.
 * Reads PDFs from local filesystem, extracts bid data via AI,
 * creates bid records + line items in Supabase.
 *
 * Registered with the agent router for the 'bid_analysis' domain.
 */

import * as fs from 'fs'
import { registerAgent } from './agent-router'
import { extractBidV2FromText } from './bid-ingestion-service'
import { createBidWithLineItems } from './bid-ingestion-service'
import { extractTextFromPDF } from './document-analyzer'
import { updateFileStatus } from './dropbox-watcher'
import { supabase } from './supabase'
import type { ChangeEvent, AgentResult, ExtractedBidV2 } from '@/types'

// Rate limit: max concurrent AI extractions
const MAX_CONCURRENT = 3
// Max files per run (avoid burning API budget in one go)
const MAX_PER_RUN = 20

/**
 * Infer vendor name from file path.
 * e.g., "Bids/Cabinets/KITCHEN - 10072025 - INSET.pdf" → folder hint "Cabinets"
 * e.g., "Bids/Stone Fabricator/QUOTE - CALCATTA GOLD.pdf" → "Stone Fabricator"
 */
function inferVendorContext(filePath: string): { vendorHint?: string; category?: string } {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const bidsIdx = parts.findIndex(p => p.toLowerCase() === 'bids')
  if (bidsIdx === -1) return {}

  // The folder immediately after "Bids/" is the category/vendor context
  const categoryFolder = parts[bidsIdx + 1]
  if (!categoryFolder) return {}

  // If there's a subfolder, that's likely the vendor
  const subFolder = parts[bidsIdx + 2]
  const isFile = subFolder && subFolder.includes('.')

  return {
    category: categoryFolder,
    vendorHint: isFile ? undefined : subFolder,
  }
}

/**
 * Read a file from local filesystem and return as Buffer.
 */
function readLocalFile(filePath: string): Buffer | null {
  try {
    return fs.readFileSync(filePath)
  } catch (err) {
    console.error(`Failed to read file ${filePath}:`, err)
    return null
  }
}

/**
 * Check if a bid already exists for this file path (dedup).
 */
async function bidExistsForFile(filePath: string): Promise<boolean> {
  const { data } = await supabase
    .from('bid_documents')
    .select('id')
    .eq('dropbox_path', filePath)
    .limit(1)

  return (data?.length || 0) > 0
}

/**
 * Process a single bid file: read → extract text → AI extraction → create records.
 */
async function processBidFile(
  filePath: string,
  fileName: string,
  projectId: string
): Promise<{
  success: boolean
  bidId?: string
  lineItemCount?: number
  error?: string
}> {
  // Dedup check
  if (await bidExistsForFile(filePath)) {
    return { success: true, error: 'Already processed (dedup)' }
  }

  const buffer = readLocalFile(filePath)
  if (!buffer) {
    return { success: false, error: 'Could not read file' }
  }

  const ext = fileName.toLowerCase().split('.').pop()
  const { vendorHint, category } = inferVendorContext(filePath)

  // Pre-filter: skip files that are clearly not vendor bids
  const lowerName = fileName.toLowerCase()
  const skipPatterns = [
    /budget/i, /comprehensive.*budget/i, /construction.*budget/i,
    /terms.*conditions/i, /site.*requirements/i, /standard.*installation/i,
    /pricing.*workflow/i, /instructions/i, /pricing.*request/i,
    /^all.*bids.*summary/i, /bill.*of.*materials/i,
  ]
  if (skipPatterns.some(p => p.test(lowerName))) {
    return { success: false, error: 'Skipped: filename indicates non-bid document' }
  }

  let extractedText: string | null = null

  if (ext === 'pdf') {
    extractedText = await extractTextFromPDF(buffer)
    if (!extractedText || extractedText.trim().length < 50) {
      return { success: false, error: 'PDF has no extractable text (may be image-based)' }
    }
  } else if (['txt', 'md', 'html', 'csv'].includes(ext || '')) {
    extractedText = buffer.toString('utf-8')
  } else {
    // xlsx, doc, docx — skip for now (would need additional parsers)
    return { success: false, error: `Unsupported file type: ${ext}` }
  }

  if (!extractedText || extractedText.trim().length < 30) {
    return { success: false, error: 'Insufficient text content' }
  }

  // AI extraction
  const context = {
    vendorName: vendorHint,
    filename: fileName,
    sourceType: `dropbox_bids/${category || 'unknown'}`,
  }

  const { bid, error: extractError } = await extractBidV2FromText(extractedText, context)

  if (!bid) {
    return { success: false, error: extractError || 'Extraction returned no data' }
  }

  // Create bid + line items in Supabase
  const created = await createBidWithLineItems(projectId, bid)
  if (!created) {
    return { success: false, error: 'Failed to save bid to database' }
  }

  // Tag with dropbox path for dedup
  await supabase
    .from('bid_documents')
    .update({ source: 'dropbox', dropbox_path: filePath })
    .eq('bid_id', created.bidId)

  return {
    success: true,
    bidId: created.bidId,
    lineItemCount: created.lineItemCount,
  }
}

/**
 * Bid Analysis Agent handler — registered with the agent router.
 * Processes bid-related change events (new/modified files in Bids/ folders).
 */
async function handleBidAnalysis(events: ChangeEvent[], projectId: string): Promise<AgentResult> {
  const result: AgentResult = {
    domain: 'bid_analysis',
    source: 'dropbox',
    action: 'process_bids',
    details: '',
    records_created: 0,
    records_updated: 0,
    errors: [],
    duration_ms: 0,
  }

  // Filter to processable files only
  const processableExts = new Set(['pdf', 'txt', 'md', 'html', 'csv'])
  const files = events
    .filter(e => e.file_path && e.file_name)
    .filter(e => {
      const ext = e.file_name!.toLowerCase().split('.').pop()
      return processableExts.has(ext || '')
    })
    .slice(0, MAX_PER_RUN)

  if (files.length === 0) {
    result.details = 'No processable bid files found'
    return result
  }

  // Process in batches of MAX_CONCURRENT
  const processed: string[] = []
  const failed: string[] = []

  for (let i = 0; i < files.length; i += MAX_CONCURRENT) {
    const batch = files.slice(i, i + MAX_CONCURRENT)

    const batchResults = await Promise.all(
      batch.map(async (event) => {
        const filePath = event.file_path!
        const fileName = event.file_name!

        await updateFileStatus(filePath, 'processing')

        const res = await processBidFile(filePath, fileName, projectId)

        if (res.success && res.bidId) {
          await updateFileStatus(filePath, 'completed', { result_id: res.bidId })
          return { fileName, success: true, bidId: res.bidId, lineItems: res.lineItemCount }
        } else if (res.success && res.error?.includes('dedup')) {
          await updateFileStatus(filePath, 'skipped', { error_message: 'Already processed' })
          return { fileName, success: true, skipped: true }
        } else {
          // Mark as failed or skipped based on error type
          const isNotABid = res.error?.includes('not_a_bid') || res.error?.includes('Not a bid')
          const status = isNotABid ? 'skipped' as const : 'failed' as const
          await updateFileStatus(filePath, status, { error_message: res.error })
          return { fileName, success: false, error: res.error }
        }
      })
    )

    for (const r of batchResults) {
      if (r.success && !('skipped' in r && r.skipped)) {
        processed.push(r.fileName)
        if ('lineItems' in r) {
          result.records_created += 1 + (r.lineItems || 0)
        }
      } else if (!r.success) {
        failed.push(`${r.fileName}: ${r.error}`)
        result.errors.push(`${r.fileName}: ${r.error}`)
      }
    }
  }

  result.details = [
    `Processed ${processed.length} bid file(s)`,
    failed.length > 0 ? `${failed.length} failed` : null,
    `${files.length - processed.length - failed.length} skipped`,
  ].filter(Boolean).join(', ')

  return result
}

// Register with the agent router
registerAgent('bid_analysis', handleBidAnalysis)

/**
 * Standalone function to process all pending bid files.
 * Called directly when you want to process the backlog.
 */
export async function processAllPendingBids(projectId: string): Promise<AgentResult> {
  // Get all pending bid files from inventory
  const { data: pendingFiles } = await supabase
    .from('file_inventory')
    .select('*')
    .eq('project_id', projectId)
    .eq('agent_domain', 'bid_analysis')
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(MAX_PER_RUN)

  if (!pendingFiles || pendingFiles.length === 0) {
    return {
      domain: 'bid_analysis',
      source: 'dropbox',
      action: 'process_pending_bids',
      details: 'No pending bid files to process',
      records_created: 0,
      records_updated: 0,
      errors: [],
      duration_ms: 0,
    }
  }

  // Convert to ChangeEvents and run through the handler
  const events: ChangeEvent[] = pendingFiles.map(f => ({
    source: 'dropbox' as const,
    domain: 'bid_analysis' as const,
    file_path: f.file_path,
    file_name: f.file_name,
    file_type: f.file_type,
    detected_at: new Date().toISOString(),
  }))

  return handleBidAnalysis(events, projectId)
}

export { handleBidAnalysis }
