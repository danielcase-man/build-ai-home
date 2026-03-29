/**
 * Takeoff Agent
 *
 * Domain agent that catalogs plan/drawing files from Dropbox.
 * Classifies architectural, structural, foundation, and detail drawings.
 * No AI extraction needed — these are reference documents that get
 * cataloged in the documents table for plan source tracking.
 *
 * Registered with the agent router for the 'takeoff' domain.
 */

import * as fs from 'fs'
import * as path from 'path'
import { registerAgent } from './agent-router'
import { updateFileStatus } from './dropbox-watcher'
import { supabase } from './supabase'
import type { ChangeEvent, AgentResult, PlanSource } from '@/types'

/**
 * Classify a plan file into a specific type based on path and name.
 */
function classifyPlanType(filePath: string, fileName: string): PlanSource['type'] {
  const lower = (filePath + '/' + fileName).toLowerCase()

  if (/structural|struct|framing/i.test(lower)) return 'structural'
  if (/foundation|slab|footing|pier/i.test(lower)) return 'foundation'
  if (/electrical|elec|lighting|panel/i.test(lower)) return 'electrical'
  if (/mechanical|hvac|duct/i.test(lower)) return 'mechanical'
  if (/plumbing|piping/i.test(lower)) return 'plumbing'
  if (/site|survey|grading|topo/i.test(lower)) return 'site'
  if (/detail|section|elevation/i.test(lower)) return 'detail'
  return 'architectural' // default for plan files
}

/**
 * Determine confidence level based on file type.
 */
function getConfidence(fileType: string): PlanSource['confidence'] {
  if (['pdf', 'txt', 'md', 'html'].includes(fileType)) return 'text_extractable'
  if (['jpg', 'jpeg', 'png', 'webp'].includes(fileType)) return 'image_ocr'
  return 'estimated'
}

/**
 * Extract a readable category from the file path.
 * e.g., "Development/Bids/Engineering Plans/Structural/file.pdf" → "Engineering Plans/Structural"
 */
function extractCategory(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  // Find recognizable plan folder markers
  const markers = ['plans', 'drawings', 'architectural', 'structural', 'engineering']
  const idx = parts.findIndex(p => markers.some(m => p.toLowerCase().includes(m)))
  if (idx !== -1) {
    // Take from marker folder to parent of filename
    return parts.slice(idx, -1).join('/')
  }
  // Fallback: last 2 dirs
  return parts.slice(-3, -1).join('/')
}

/**
 * Takeoff Agent handler — catalogs plan/drawing files.
 */
async function handleTakeoff(events: ChangeEvent[], projectId: string): Promise<AgentResult> {
  const result: AgentResult = {
    domain: 'takeoff',
    source: 'dropbox',
    action: 'catalog_plans',
    details: '',
    records_created: 0,
    records_updated: 0,
    errors: [],
    duration_ms: 0,
  }

  const fileEvents = events.filter(e => e.file_path && e.file_name)
  if (fileEvents.length === 0) {
    result.details = 'No plan files to catalog'
    return result
  }

  for (const event of fileEvents) {
    const filePath = event.file_path!
    const fileName = event.file_name!
    const fileType = event.file_type || path.extname(fileName).replace('.', '')

    try {
      // Check if already cataloged in documents table
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('file_url', filePath)
        .limit(1)

      if (existing && existing.length > 0) {
        await updateFileStatus(filePath, 'skipped', { error_message: 'Already cataloged' })
        continue
      }

      const planType = classifyPlanType(filePath, fileName)
      const category = extractCategory(filePath)
      const confidence = getConfidence(fileType)

      // Get file size
      let fileSize = 0
      try {
        const stat = fs.statSync(filePath)
        fileSize = stat.size
      } catch { /* file may have moved */ }

      // Insert into documents table
      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          name: fileName,
          category: category || 'Plans',
          file_url: filePath,
          file_type: fileType,
          file_size: fileSize,
          notes: JSON.stringify({
            plan_type: planType,
            confidence,
            source: 'intelligence_engine',
            cataloged_at: new Date().toISOString(),
          }),
        })

      if (insertError) {
        result.errors.push(`${fileName}: ${insertError.message}`)
        await updateFileStatus(filePath, 'failed', { error_message: insertError.message })
      } else {
        result.records_created++
        await updateFileStatus(filePath, 'completed')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      result.errors.push(`${fileName}: ${msg}`)
      await updateFileStatus(filePath, 'failed', { error_message: msg })
    }
  }

  result.details = `Cataloged ${result.records_created} plan/drawing file(s)`
  if (result.errors.length > 0) {
    result.details += `, ${result.errors.length} failed`
  }

  return result
}

registerAgent('takeoff', handleTakeoff)
export { handleTakeoff }
