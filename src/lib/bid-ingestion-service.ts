/**
 * Bid Ingestion Service — agentic pipeline for extracting bids from any source.
 *
 * Three ingestion paths:
 *   1. Upload (PDF/image/doc) → extractBidFromFile()
 *   2. Email attachments → scanEmailsForBids()
 *   3. Dropbox folder scan → scanDropboxForBids()
 *
 * All paths converge to extractBidV2() → createBidWithLineItems()
 */

import { getAnthropicClient, parseAIJsonResponse } from './ai-clients'
import { extractTextFromPDF } from './document-analyzer'
import { supabase } from './supabase'
import { createBidDocument, updateExtractionStatus } from './bid-documents-service'
import { createLineItemsFromExtraction } from './bid-line-items-service'
import type { ExtractedBidV2, ExtractedLineItem, BidDocument } from '@/types'

// ─── Room list for AI context (helps with room assignment) ───────────────────

const PROJECT_ROOMS = [
  'Kitchen', 'Pantry', 'Dining Room', 'Living Room', 'Foyer',
  'Primary Bath', 'Bath 2', 'Bath 3', 'Bath 4', 'Powder Bath',
  'Primary Bedroom', 'Bedroom 2', 'Bedroom 3', 'Bedroom 4',
  'Classroom', 'Utility / Laundry', 'Garage', 'Dog Wash',
  'Built-Ins', 'Whole House', 'Exterior',
]

// ─── V2 Extraction Prompt ────────────────────────────────────────────────────

function buildExtractionPrompt(context: {
  vendorName?: string
  filename?: string
  sourceType: string
}): string {
  return `You are an AI assistant that extracts structured bid/quote information from construction documents.

${context.vendorName ? `KNOWN VENDOR: ${context.vendorName}` : ''}
${context.filename ? `DOCUMENT: ${context.filename}` : ''}
SOURCE: ${context.sourceType}

PROJECT CONTEXT: Custom home build, 7,526 sq ft French Country, Liberty Hill TX.
ROOMS: ${PROJECT_ROOMS.join(', ')}

EXTRACTION INSTRUCTIONS:
1. Extract vendor info (company, contact, email, phone)
2. Categorize the work using standard categories (see below)
3. Extract EVERY line item individually with:
   - Item name and description
   - Room assignment (match to project rooms above, or "Whole House")
   - Quantity, unit (sqft, each, linear_ft, lot), unit price, total price
   - Brand, model number, finish, color, material when available
   - Specs and notes
4. Extract scope, inclusions, exclusions, payment terms, lead time, warranty
5. Assess confidence (0.0 to 1.0)

STANDARD CATEGORIES:
"Site Work", "Well & Septic", "Foundation", "Framing", "Roofing",
"Windows & Doors", "Siding & Exterior", "MEP - HVAC", "MEP - Plumbing",
"MEP - Electrical", "Insulation", "Drywall", "Flooring", "Cabinetry",
"Countertops", "Interior Finishes", "Appliances", "Plumbing Fixtures",
"Lighting", "Exterior Lighting", "Garage Doors", "Landscaping",
"Pool & Spa", "Paint", "Tile", "Hardware", "Civil Engineering",
"Foundation Engineering", "Other"

CRITICAL: Extract EVERY individual line item. If a bid says "10 windows" list each window if specs differ, or one line with qty=10 if identical. Be thorough.

Return ONLY valid JSON:
{
  "vendor_name": "Company Name",
  "vendor_contact": "Person (if mentioned)",
  "vendor_email": "email (if found)",
  "vendor_phone": "phone (if found)",
  "category": "Standard category",
  "subcategory": "More specific",
  "description": "Brief summary of bid scope",
  "total_amount": 12345.67,
  "scope_of_work": "Detailed scope",
  "inclusions": ["included item 1"],
  "exclusions": ["excluded item 1"],
  "payment_terms": "terms",
  "warranty_terms": "warranty",
  "estimated_duration": "timeline",
  "lead_time_weeks": 8,
  "valid_until": "2026-MM-DD",
  "ai_confidence": 0.95,
  "ai_extraction_notes": "any uncertainties",
  "line_items_v2": [
    {
      "item_name": "Specific item",
      "item_description": "Details",
      "room": "Kitchen",
      "quantity": 1,
      "unit": "each",
      "unit_price": 500.00,
      "total_price": 500.00,
      "brand": "Brand",
      "model_number": "Model",
      "finish": "Finish",
      "color": "Color",
      "material": "Material",
      "specs": "Technical specs",
      "notes": "Notes",
      "category": "Same as parent or finer",
      "subcategory": "Sub"
    }
  ]
}

If the document is NOT a bid/quote, return: {"error": "not_a_bid", "reason": "explanation"}`
}

// ─── Core V2 Extraction (text-based) ─────────────────────────────────────────

export async function extractBidV2FromText(
  text: string,
  context: { vendorName?: string; filename?: string; sourceType: string }
): Promise<{ bid: ExtractedBidV2 | null; error?: string }> {
  const prompt = buildExtractionPrompt(context)

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: `${prompt}\n\nDOCUMENT CONTENT:\n${text.substring(0, 30000)}`,
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return { bid: null, error: 'No text response' }

    const parsed = parseAIJsonResponse(content.text) as Record<string, unknown>

    if (parsed.error === 'not_a_bid') {
      return { bid: null, error: `Not a bid: ${parsed.reason}` }
    }

    return { bid: parsed as unknown as ExtractedBidV2 }
  } catch (error) {
    console.error('V2 extraction error:', error)
    return { bid: null, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─── Core V2 Extraction (image/vision-based) ────────────────────────────────

export async function extractBidV2FromImage(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  context: { vendorName?: string; filename?: string; sourceType: string }
): Promise<{ bid: ExtractedBidV2 | null; error?: string }> {
  const prompt = buildExtractionPrompt(context)

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return { bid: null, error: 'No text response' }

    const parsed = parseAIJsonResponse(content.text) as Record<string, unknown>

    if (parsed.error === 'not_a_bid') {
      return { bid: null, error: `Not a bid: ${parsed.reason}` }
    }

    return { bid: parsed as unknown as ExtractedBidV2 }
  } catch (error) {
    console.error('V2 vision extraction error:', error)
    return { bid: null, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ─── Create bid + line items from extraction result ──────────────────────────

export async function createBidWithLineItems(
  projectId: string,
  extracted: ExtractedBidV2,
  documentId?: string
): Promise<{ bidId: string; lineItemCount: number } | null> {
  // Check for existing vendor
  const { data: existingVendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('project_id', projectId)
    .ilike('company_name', extracted.vendor_name)
    .limit(1)
    .single()

  // Create the bid record
  const { data: bid, error: bidError } = await supabase
    .from('bids')
    .insert({
      project_id: projectId,
      vendor_id: existingVendor?.id || null,
      vendor_name: extracted.vendor_name,
      vendor_contact: extracted.vendor_contact || null,
      vendor_email: extracted.vendor_email || null,
      vendor_phone: extracted.vendor_phone || null,
      category: extracted.category,
      subcategory: extracted.subcategory || null,
      description: extracted.description,
      total_amount: extracted.total_amount,
      line_items: extracted.line_items_v2 || null,
      scope_of_work: extracted.scope_of_work || null,
      inclusions: extracted.inclusions || null,
      exclusions: extracted.exclusions || null,
      payment_terms: extracted.payment_terms || null,
      warranty_terms: extracted.warranty_terms || null,
      estimated_duration: extracted.estimated_duration || null,
      lead_time_weeks: extracted.lead_time_weeks || null,
      valid_until: extracted.valid_until || null,
      status: 'under_review',
      ai_extracted: true,
      ai_confidence: extracted.ai_confidence,
      ai_extraction_notes: extracted.ai_extraction_notes || null,
      needs_review: (extracted.ai_confidence || 0) < 0.85,
      bid_date: new Date().toISOString().split('T')[0],
      received_date: new Date().toISOString().split('T')[0],
      source: 'ai_extracted',
      document_id: documentId || null,
    })
    .select('id')
    .single()

  if (bidError || !bid) {
    console.error('Error creating bid:', bidError)
    return null
  }

  // Create normalized line items
  const lineItems = await createLineItemsFromExtraction(
    bid.id,
    extracted.line_items_v2 || [],
    extracted.category
  )

  return { bidId: bid.id, lineItemCount: lineItems.length }
}

// ─── Path 1: File Upload ─────────────────────────────────────────────────────

export async function extractBidFromFile(
  projectId: string,
  fileBuffer: Buffer,
  filename: string,
  fileType: string,
  vendorName?: string
): Promise<{ bidId: string; lineItemCount: number; error?: string } | null> {
  // Store the document
  const storagePath = `${projectId}/bid-documents/${Date.now()}-${filename}`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, fileBuffer, { contentType: fileType })

  if (uploadError) {
    console.error('Error uploading bid document:', uploadError)
    // Continue without storage — extraction can still work
  }

  const doc = await createBidDocument({
    project_id: projectId,
    filename,
    file_type: fileType,
    file_size: fileBuffer.length,
    storage_path: storagePath,
    source: 'upload',
  })

  if (doc) {
    await updateExtractionStatus(doc.id, { extraction_status: 'processing' })
  }

  const context = { vendorName, filename, sourceType: 'file_upload' }

  let result: { bid: ExtractedBidV2 | null; error?: string }

  if (fileType === 'application/pdf') {
    const text = await extractTextFromPDF(fileBuffer)
    if (!text || text.trim().length < 50) {
      // PDF might be image-based — try vision
      // For now, return error; could convert PDF pages to images in future
      if (doc) await updateExtractionStatus(doc.id, { extraction_status: 'failed', ai_extraction_notes: 'PDF has no extractable text' })
      return { bidId: '', lineItemCount: 0, error: 'PDF has no extractable text — try uploading as image' }
    }
    result = await extractBidV2FromText(text, context)
  } else if (fileType.startsWith('image/')) {
    const base64 = fileBuffer.toString('base64')
    const mediaType = fileType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    result = await extractBidV2FromImage(base64, mediaType, context)
  } else {
    // Try as text (Word docs, CSV, etc.)
    const text = fileBuffer.toString('utf-8')
    result = await extractBidV2FromText(text, context)
  }

  if (!result.bid) {
    if (doc) await updateExtractionStatus(doc.id, { extraction_status: 'failed', ai_extraction_notes: result.error || 'Extraction failed' })
    return { bidId: '', lineItemCount: 0, error: result.error || 'Could not extract bid' }
  }

  const created = await createBidWithLineItems(projectId, result.bid, doc?.id)
  if (!created) {
    if (doc) await updateExtractionStatus(doc.id, { extraction_status: 'failed', ai_extraction_notes: 'Failed to save bid' })
    return { bidId: '', lineItemCount: 0, error: 'Failed to save extracted bid' }
  }

  if (doc) {
    await updateExtractionStatus(doc.id, {
      extraction_status: 'completed',
      bid_id: created.bidId,
      ai_confidence: result.bid.ai_confidence,
      ai_extraction_notes: result.bid.ai_extraction_notes,
    })
  }

  return { bidId: created.bidId, lineItemCount: created.lineItemCount }
}

// ─── Path 2: Email Attachment Scanner ────────────────────────────────────────

export async function scanEmailForBidAttachments(
  projectId: string,
  emailId: string,
  messageId: string,
  gmailService: { getAttachment: (messageId: string, attachmentId: string) => Promise<Buffer | null> }
): Promise<Array<{ bidId: string; lineItemCount: number; filename: string }>> {
  const results: Array<{ bidId: string; lineItemCount: number; filename: string }> = []

  // Get attachment metadata from our DB
  const { data: attachments } = await supabase
    .from('email_attachments')
    .select('id, filename, file_type, gmail_attachment_id')
    .eq('email_id', emailId)
    .not('gmail_attachment_id', 'is', null)

  if (!attachments || attachments.length === 0) return results

  // Filter to likely bid documents
  const bidAttachments = attachments.filter(att => {
    const ext = att.filename?.toLowerCase() || ''
    return ext.endsWith('.pdf') || ext.endsWith('.xlsx') || ext.endsWith('.xls')
      || ext.endsWith('.doc') || ext.endsWith('.docx') || ext.endsWith('.csv')
      || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png')
  })

  for (const att of bidAttachments) {
    try {
      const buffer = await gmailService.getAttachment(messageId, att.gmail_attachment_id)
      if (!buffer) continue

      const extracted = await extractBidFromFile(projectId, buffer, att.filename, att.file_type || 'application/octet-stream')

      if (extracted && extracted.bidId) {
        // Update the bid document source to email_attachment
        await supabase
          .from('bid_documents')
          .update({ source: 'email_attachment', email_id: emailId })
          .eq('bid_id', extracted.bidId)

        results.push({ bidId: extracted.bidId, lineItemCount: extracted.lineItemCount, filename: att.filename })
      }
    } catch (error) {
      console.error(`Error processing attachment ${att.filename}:`, error)
    }
  }

  return results
}

// ─── Path 3: Dropbox Folder Scanner ──────────────────────────────────────────

export interface DropboxBidFile {
  path: string
  name: string
  fileId: string
  size: number
}

/**
 * Given a list of Dropbox files (from a folder scan), download and extract bids.
 * The caller is responsible for listing the files via the Dropbox MCP.
 * This function processes each file through the extraction pipeline.
 */
export async function processDropboxBidFiles(
  projectId: string,
  files: DropboxBidFile[],
  getFileContent: (path: string) => Promise<Buffer | null>
): Promise<Array<{ bidId: string; lineItemCount: number; filename: string; error?: string }>> {
  const results: Array<{ bidId: string; lineItemCount: number; filename: string; error?: string }> = []

  // Filter to likely bid documents
  const bidFiles = files.filter(f => {
    const ext = f.name.toLowerCase()
    return ext.endsWith('.pdf') || ext.endsWith('.xlsx') || ext.endsWith('.xls')
      || ext.endsWith('.doc') || ext.endsWith('.docx')
      || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png')
  })

  // Skip files already processed (check by dropbox_path)
  const { data: existing } = await supabase
    .from('bid_documents')
    .select('dropbox_path')
    .eq('project_id', projectId)
    .not('dropbox_path', 'is', null)

  const processedPaths = new Set((existing || []).map(d => d.dropbox_path))

  for (const file of bidFiles) {
    if (processedPaths.has(file.path)) {
      continue // Already processed
    }

    try {
      const buffer = await getFileContent(file.path)
      if (!buffer) {
        results.push({ bidId: '', lineItemCount: 0, filename: file.name, error: 'Could not download file' })
        continue
      }

      // Infer vendor name from folder structure
      // e.g., "Bids/Cabinets/ProSource_Analysis.pdf" → vendor hint from filename
      const vendorHint = inferVendorFromPath(file.path, file.name)
      const fileType = inferMimeType(file.name)

      const extracted = await extractBidFromFile(projectId, buffer, file.name, fileType, vendorHint)

      if (extracted && extracted.bidId) {
        // Tag with dropbox path for dedup
        await supabase
          .from('bid_documents')
          .update({ source: 'dropbox', dropbox_path: file.path })
          .eq('bid_id', extracted.bidId)

        results.push({ bidId: extracted.bidId, lineItemCount: extracted.lineItemCount, filename: file.name })
      } else {
        results.push({ bidId: '', lineItemCount: 0, filename: file.name, error: extracted?.error || 'Extraction failed' })
      }
    } catch (error) {
      results.push({ bidId: '', lineItemCount: 0, filename: file.name, error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  return results
}

function inferVendorFromPath(path: string, filename: string): string | undefined {
  // Try to get vendor hint from filename
  // "ProSource_Itemized_Analysis_ES618204.xlsx" → "ProSource"
  // "Case, Daniel countertop bid 10.09.25.pdf" → undefined (not a vendor name)
  // "Quote 410012.pdf" → undefined
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
  const parts = nameWithoutExt.split(/[_\s-]+/)
  // If first word looks like a company name (capitalized, not a common word)
  const skipWords = new Set(['case', 'quote', 'bid', 'estimate', 'proposal', 'invoice', 'daniel', 'the', 'a', 'an'])
  const firstWord = parts[0]?.toLowerCase()
  if (firstWord && !skipWords.has(firstWord) && /^[A-Z]/.test(parts[0])) {
    return parts[0]
  }
  return undefined
}

function inferMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
  }
  return mimeMap[ext || ''] || 'application/octet-stream'
}
