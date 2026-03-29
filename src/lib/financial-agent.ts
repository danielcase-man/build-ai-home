/**
 * Financial Agent
 *
 * Domain agent that processes financial documents from Dropbox:
 * invoices, receipts, budget files, and draw schedules.
 *
 * For PDFs with text: uses AI to extract vendor, amount, date, description.
 * For spreadsheets and budget files: catalogs them as reference documents.
 *
 * Registered with the agent router for the 'financial' domain.
 */

import * as fs from 'fs'
import { registerAgent } from './agent-router'
import { updateFileStatus } from './dropbox-watcher'
import { extractTextFromPDF } from './document-analyzer'
import { supabase } from './supabase'
import type { ChangeEvent, AgentResult } from '@/types'

// Max files per run (budget-conscious)
const MAX_PER_RUN = 15
const MAX_CONCURRENT = 3

interface ExtractedFinancial {
  type: 'invoice' | 'receipt' | 'budget' | 'draw_schedule' | 'other'
  vendor_name?: string
  amount?: number
  date?: string
  description?: string
  invoice_number?: string
  notes?: string
}

/**
 * Classify the financial sub-type from path/name.
 */
function classifyFinancialType(filePath: string, fileName: string): ExtractedFinancial['type'] {
  const lower = (filePath + '/' + fileName).toLowerCase()
  if (/invoice/i.test(lower)) return 'invoice'
  if (/receipt/i.test(lower)) return 'receipt'
  if (/draw.?schedule|disbursement/i.test(lower)) return 'draw_schedule'
  if (/budget|estimate|cost/i.test(lower)) return 'budget'
  return 'other'
}

/**
 * Use Claude to extract financial data from document text.
 */
async function extractFinancialData(
  text: string,
  fileName: string,
  subType: ExtractedFinancial['type']
): Promise<ExtractedFinancial | null> {
  try {
    const { getAnthropicClient } = await import('./ai-clients')

    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract financial data from this ${subType} document.

Filename: ${fileName}

Document text:
${text.slice(0, 4000)}

Return ONLY valid JSON (no markdown, no code fences):
{
  "type": "${subType}",
  "vendor_name": "string or null",
  "amount": number or null (total amount in dollars),
  "date": "YYYY-MM-DD or null",
  "description": "brief description",
  "invoice_number": "string or null",
  "notes": "any relevant details"
}`,
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return null

    return JSON.parse(content.text) as ExtractedFinancial
  } catch (err) {
    console.error(`Financial extraction failed for ${fileName}:`, err)
    return null
  }
}

/**
 * Process a single financial file.
 */
async function processFinancialFile(
  filePath: string,
  fileName: string,
  projectId: string,
): Promise<{ success: boolean; action?: string; error?: string }> {
  // Check dedup
  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('file_url', filePath)
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: true, action: 'skipped_dedup' }
  }

  const ext = fileName.toLowerCase().split('.').pop() || ''
  const subType = classifyFinancialType(filePath, fileName)

  // For spreadsheets, just catalog — no AI extraction
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    const { error } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        name: fileName,
        category: 'Financial',
        file_url: filePath,
        file_type: ext,
        source_path: filePath,
        ai_classification: `financial_type:${subType}`,
        description: `${subType} document — cataloged by intelligence engine`,
      })

    return error
      ? { success: false, error: error.message }
      : { success: true, action: 'cataloged' }
  }

  // For PDFs, extract text and use AI
  if (ext === 'pdf') {
    let buffer: Buffer
    try {
      buffer = fs.readFileSync(filePath)
    } catch {
      return { success: false, error: 'Could not read file' }
    }

    const text = await extractTextFromPDF(buffer)
    if (!text || text.trim().length < 30) {
      return { success: false, error: 'No extractable text in PDF' }
    }

    const extracted = await extractFinancialData(text, fileName, subType)

    // Catalog the document regardless
    await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        name: fileName,
        category: 'Financial',
        file_url: filePath,
        file_type: ext,
        source_path: filePath,
        ai_classification: `financial_type:${subType}`,
        ai_summary: extracted ? `${extracted.vendor_name || 'Unknown'}: $${extracted.amount || 0} (${extracted.date || 'no date'})` : null,
        description: extracted?.description || `${subType} document — cataloged by intelligence engine`,
      })

    // If it's an invoice with enough data, create an invoice record
    if (extracted && subType === 'invoice' && extracted.amount && extracted.vendor_name) {
      const { error: invError } = await supabase
        .from('invoices')
        .insert({
          project_id: projectId,
          invoice_number: extracted.invoice_number || null,
          description: extracted.description || fileName,
          amount: extracted.amount,
          tax_amount: 0,
          total_amount: extracted.amount,
          date_issued: extracted.date || new Date().toISOString().slice(0, 10),
          status: 'received',
          document_url: filePath,
          notes: `Auto-extracted by intelligence engine from ${fileName}`,
        })

      if (invError) {
        return { success: true, action: 'cataloged_invoice_failed', error: invError.message }
      }
      return { success: true, action: 'invoice_created' }
    }

    return { success: true, action: 'cataloged_with_extraction' }
  }

  // For text-based files, catalog without AI
  await supabase
    .from('documents')
    .insert({
      project_id: projectId,
      name: fileName,
      category: 'Financial',
      file_url: filePath,
      file_type: ext,
      source_path: filePath,
      ai_classification: `financial_type:${subType}`,
      description: `${subType} document — cataloged by intelligence engine`,
    })

  return { success: true, action: 'cataloged' }
}

/**
 * Financial Agent handler.
 */
async function handleFinancial(events: ChangeEvent[], projectId: string): Promise<AgentResult> {
  const result: AgentResult = {
    domain: 'financial',
    source: 'dropbox',
    action: 'process_financial',
    details: '',
    records_created: 0,
    records_updated: 0,
    errors: [],
    duration_ms: 0,
  }

  const fileEvents = events
    .filter(e => e.file_path && e.file_name)
    .slice(0, MAX_PER_RUN)

  if (fileEvents.length === 0) {
    result.details = 'No financial files to process'
    return result
  }

  const actions: string[] = []

  for (let i = 0; i < fileEvents.length; i += MAX_CONCURRENT) {
    const batch = fileEvents.slice(i, i + MAX_CONCURRENT)

    const batchResults = await Promise.all(
      batch.map(async (event) => {
        const filePath = event.file_path!
        const fileName = event.file_name!

        await updateFileStatus(filePath, 'processing')
        const res = await processFinancialFile(filePath, fileName, projectId)

        if (res.success) {
          const status = res.action === 'skipped_dedup' ? 'skipped' as const : 'completed' as const
          await updateFileStatus(filePath, status, {
            error_message: res.action === 'skipped_dedup' ? 'Already cataloged' : undefined,
          })
          if (res.action && res.action !== 'skipped_dedup') {
            result.records_created++
            actions.push(res.action)
          }
        } else {
          await updateFileStatus(filePath, 'failed', { error_message: res.error })
          result.errors.push(`${fileName}: ${res.error}`)
        }

        return res
      })
    )
  }

  const invoicesCreated = actions.filter(a => a === 'invoice_created').length
  const cataloged = actions.filter(a => a.startsWith('cataloged')).length

  result.details = [
    cataloged > 0 ? `${cataloged} cataloged` : null,
    invoicesCreated > 0 ? `${invoicesCreated} invoices extracted` : null,
    result.errors.length > 0 ? `${result.errors.length} failed` : null,
  ].filter(Boolean).join(', ') || 'No new financial files'

  return result
}

registerAgent('financial', handleFinancial)
export { handleFinancial }
