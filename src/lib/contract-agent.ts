/**
 * Contract Agent
 *
 * Domain agent that processes contract/agreement documents from Dropbox.
 * Extracts key contract data (parties, dates, terms) via AI and creates
 * contract records in Supabase.
 *
 * Registered with the agent router for the 'contract' domain.
 */

import * as fs from 'fs'
import { registerAgent } from './agent-router'
import { updateFileStatus } from './dropbox-watcher'
import { extractTextFromPDF } from './document-analyzer'
import { supabase } from './supabase'
import type { ChangeEvent, AgentResult } from '@/types'

const MAX_PER_RUN = 10

interface ExtractedContract {
  title: string
  vendor_name?: string
  total_amount?: number
  payment_terms?: string
  start_date?: string
  end_date?: string
  description?: string
  status: 'draft' | 'active' | 'completed'
  notes?: string
}

/**
 * Use Claude to extract contract data from document text.
 */
async function extractContractData(
  text: string,
  fileName: string,
): Promise<ExtractedContract | null> {
  try {
    const { getAnthropicClient } = await import('./ai-clients')

    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract contract/agreement data from this document.

Filename: ${fileName}

Document text:
${text.slice(0, 6000)}

Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "contract title or description",
  "vendor_name": "string or null - the contractor/vendor/company",
  "total_amount": number or null (total contract value in dollars),
  "payment_terms": "string or null (e.g., 'Net 30', 'Per draw schedule')",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "description": "brief scope description",
  "status": "draft" or "active" or "completed",
  "notes": "key terms, special conditions, or relevant details"
}

If this is NOT actually a contract or agreement, return: {"title": "NOT_A_CONTRACT"}`,
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return null

    const parsed = JSON.parse(content.text) as ExtractedContract
    if (parsed.title === 'NOT_A_CONTRACT') return null
    return parsed
  } catch (err) {
    console.error(`Contract extraction failed for ${fileName}:`, err)
    return null
  }
}

/**
 * Contract Agent handler.
 */
async function handleContract(events: ChangeEvent[], projectId: string): Promise<AgentResult> {
  const result: AgentResult = {
    domain: 'contract',
    source: 'dropbox',
    action: 'process_contracts',
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
    result.details = 'No contract files to process'
    return result
  }

  for (const event of fileEvents) {
    const filePath = event.file_path!
    const fileName = event.file_name!
    const ext = fileName.toLowerCase().split('.').pop() || ''

    try {
      // Dedup check
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('file_url', filePath)
        .limit(1)

      if (existing && existing.length > 0) {
        await updateFileStatus(filePath, 'skipped', { error_message: 'Already cataloged' })
        continue
      }

      await updateFileStatus(filePath, 'processing')

      // Read and extract text from PDFs
      let extracted: ExtractedContract | null = null

      if (ext === 'pdf') {
        let buffer: Buffer
        try {
          buffer = fs.readFileSync(filePath)
        } catch {
          result.errors.push(`${fileName}: Could not read file`)
          await updateFileStatus(filePath, 'failed', { error_message: 'Could not read file' })
          continue
        }

        const text = await extractTextFromPDF(buffer)
        if (text && text.trim().length >= 50) {
          extracted = await extractContractData(text, fileName)
        }
      } else if (['txt', 'md', 'html'].includes(ext)) {
        try {
          const text = fs.readFileSync(filePath, 'utf-8')
          if (text.trim().length >= 50) {
            extracted = await extractContractData(text, fileName)
          }
        } catch { /* skip */ }
      }

      // Catalog the document
      await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          name: fileName,
          category: 'Contracts',
          file_url: filePath,
          file_type: ext,
          source_path: filePath,
          ai_classification: 'contract',
          ai_summary: extracted ? `${extracted.title}: ${extracted.vendor_name || 'unknown vendor'}, $${extracted.total_amount || 0}` : null,
          description: extracted?.description || `Contract document — cataloged by intelligence engine`,
        })

      // If we got good extraction, create a contract record
      if (extracted && extracted.title !== 'NOT_A_CONTRACT') {
        const { error: contractError } = await supabase
          .from('contracts')
          .insert({
            project_id: projectId,
            title: extracted.title,
            description: extracted.description,
            total_amount: extracted.total_amount || 0,
            payment_terms: extracted.payment_terms,
            start_date: extracted.start_date,
            end_date: extracted.end_date,
            status: extracted.status || 'draft',
            document_url: filePath,
            notes: `Auto-extracted by intelligence engine. Vendor: ${extracted.vendor_name || 'unknown'}. ${extracted.notes || ''}`,
          })

        if (contractError) {
          result.errors.push(`${fileName}: contract insert failed: ${contractError.message}`)
        } else {
          result.records_created++
        }
      }

      result.records_created++ // document catalog count
      await updateFileStatus(filePath, 'completed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      result.errors.push(`${fileName}: ${msg}`)
      await updateFileStatus(filePath, 'failed', { error_message: msg })
    }
  }

  result.details = `Processed ${result.records_created} contract file(s)`
  if (result.errors.length > 0) {
    result.details += `, ${result.errors.length} errors`
  }

  return result
}

registerAgent('contract', handleContract)
export { handleContract }
