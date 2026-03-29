/**
 * Incremental Dropbox File Watcher
 *
 * Scans the local Dropbox project directory for new/modified files
 * since the last scan. Compares filesystem state against file_inventory
 * in Supabase. Only returns changes — never rescans everything.
 *
 * Uses local filesystem access (the Dropbox folder is synced locally).
 */

import * as fs from 'fs'
import * as path from 'path'
import { supabase } from './supabase'
import { getWatermark, updateWatermark } from './source-watermarks'
import type { FileInventoryRecord, ChangeEvent } from '@/types'
import { classifyFileByPath } from './agent-router'

const DROPBOX_BASE = 'C:/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove'

// File extensions we care about
const PROCESSABLE_EXTENSIONS = new Set([
  '.pdf', '.xlsx', '.xls', '.doc', '.docx', '.csv',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.txt', '.md', '.html',
])

// Directories to skip entirely
const SKIP_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.venv',
  'plumbing-cart-automation',
])

/**
 * Walk a directory tree and return all files with metadata.
 */
function walkDirectory(dir: string): Array<{
  filePath: string
  fileName: string
  fileType: string
  fileSize: number
  modifiedAt: Date
}> {
  const results: Array<{
    filePath: string
    fileName: string
    fileType: string
    fileSize: number
    modifiedAt: Date
  }> = []

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name).replace(/\\/g, '/')

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        results.push(...walkDirectory(fullPath))
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (!PROCESSABLE_EXTENSIONS.has(ext)) continue
        // Skip temp files (Dropbox/Office temp files start with ~$)
        if (entry.name.startsWith('~$')) continue

        try {
          const stat = fs.statSync(fullPath)
          results.push({
            filePath: fullPath,
            fileName: entry.name,
            fileType: ext.replace('.', ''),
            fileSize: stat.size,
            modifiedAt: stat.mtime,
          })
        } catch {
          // File may have been moved/deleted between readdir and stat
        }
      }
    }
  } catch (err) {
    console.error(`Error walking directory ${dir}:`, err)
  }

  return results
}

/**
 * Extract the folder category from a Dropbox path.
 * e.g., ".../Development/Bids/Cabinets/file.pdf" → "Bids/Cabinets"
 */
export function extractFolderCategory(filePath: string): string {
  const relative = filePath.replace(DROPBOX_BASE, '').replace(/^\//, '')
  const parts = relative.split('/')
  // Remove the filename and take up to 2 directory levels
  parts.pop()
  return parts.slice(0, 3).join('/')
}

/**
 * Scan the Dropbox directory incrementally.
 * Returns only NEW or MODIFIED files since last scan.
 */
export async function scanDropboxIncremental(
  projectId: string,
  subDir?: string
): Promise<{
  newFiles: ChangeEvent[]
  modifiedFiles: ChangeEvent[]
  totalScanned: number
  errors: string[]
}> {
  const scanDir = subDir
    ? `${DROPBOX_BASE}/${subDir}`
    : DROPBOX_BASE

  const errors: string[] = []
  const newFiles: ChangeEvent[] = []
  const modifiedFiles: ChangeEvent[] = []

  // 1. Walk the filesystem
  const fsFiles = walkDirectory(scanDir)
  const now = new Date().toISOString()

  // 2. Get known files from DB
  const { data: knownFiles } = await supabase
    .from('file_inventory')
    .select('file_path, modified_at, processing_status')
    .eq('project_id', projectId)

  const knownMap = new Map(
    (knownFiles || []).map(f => [f.file_path, f])
  )

  // 3. Compare: find new and modified files
  const upserts: Array<Partial<FileInventoryRecord>> = []

  for (const file of fsFiles) {
    const known = knownMap.get(file.filePath)
    const folderCategory = extractFolderCategory(file.filePath)
    const domain = classifyFileByPath(file.filePath, file.fileName)

    if (!known) {
      // New file
      newFiles.push({
        source: 'dropbox',
        domain,
        file_path: file.filePath,
        file_name: file.fileName,
        file_type: file.fileType,
        detected_at: now,
        metadata: { folder_category: folderCategory, file_size: file.fileSize },
      })

      upserts.push({
        project_id: projectId,
        file_path: file.filePath,
        file_name: file.fileName,
        file_type: file.fileType,
        file_size: file.fileSize,
        modified_at: file.modifiedAt.toISOString(),
        folder_category: folderCategory,
        processing_status: 'pending',
        agent_domain: domain,
      })
    } else {
      // Check if modified (compare timestamps with 1-second tolerance)
      const knownTime = new Date(known.modified_at).getTime()
      const fsTime = file.modifiedAt.getTime()

      if (Math.abs(fsTime - knownTime) > 1000) {
        modifiedFiles.push({
          source: 'dropbox',
          domain,
          file_path: file.filePath,
          file_name: file.fileName,
          file_type: file.fileType,
          detected_at: now,
          metadata: { folder_category: folderCategory, file_size: file.fileSize },
        })

        upserts.push({
          project_id: projectId,
          file_path: file.filePath,
          file_name: file.fileName,
          file_type: file.fileType,
          file_size: file.fileSize,
          modified_at: file.modifiedAt.toISOString(),
          folder_category: folderCategory,
          processing_status: 'pending',
          agent_domain: domain,
        })
      }
    }
  }

  // 4. Batch upsert to DB
  if (upserts.length > 0) {
    // Process in batches of 50
    for (let i = 0; i < upserts.length; i += 50) {
      const batch = upserts.slice(i, i + 50)
      const { error } = await supabase
        .from('file_inventory')
        .upsert(batch, { onConflict: 'file_path' })

      if (error) {
        errors.push(`Batch upsert failed: ${error.message}`)
      }
    }
  }

  // 5. Update watermark
  await updateWatermark('dropbox', {
    last_processed_at: now,
    items_processed: fsFiles.length,
    errors: errors.length,
    metadata: {
      total_files: fsFiles.length,
      new_files: newFiles.length,
      modified_files: modifiedFiles.length,
      scan_dir: scanDir,
    },
  })

  return {
    newFiles,
    modifiedFiles,
    totalScanned: fsFiles.length,
    errors,
  }
}

/**
 * Get pending files that need processing, grouped by domain.
 */
export async function getPendingFiles(
  projectId: string,
  domain?: string,
  limit = 50
): Promise<FileInventoryRecord[]> {
  let query = supabase
    .from('file_inventory')
    .select('*')
    .eq('project_id', projectId)
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (domain) {
    query = query.eq('agent_domain', domain)
  }

  const { data, error } = await query
  if (error) return []
  return (data || []) as FileInventoryRecord[]
}

/**
 * Update a file's processing status.
 */
export async function updateFileStatus(
  filePath: string,
  status: FileInventoryRecord['processing_status'],
  details?: { result_id?: string; error_message?: string }
): Promise<void> {
  const update: Record<string, unknown> = {
    processing_status: status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'completed' || status === 'failed') {
    update.processed_at = new Date().toISOString()
  }
  if (details?.result_id) update.result_id = details.result_id
  if (details?.error_message) update.error_message = details.error_message

  await supabase
    .from('file_inventory')
    .update(update)
    .eq('file_path', filePath)
}

/**
 * Get stats on the file inventory.
 */
export async function getInventoryStats(projectId: string): Promise<{
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  skipped: number
  byDomain: Record<string, number>
}> {
  const { data } = await supabase
    .from('file_inventory')
    .select('processing_status, agent_domain')
    .eq('project_id', projectId)

  const files = data || []
  const byDomain: Record<string, number> = {}

  for (const f of files) {
    if (f.agent_domain) {
      byDomain[f.agent_domain] = (byDomain[f.agent_domain] || 0) + 1
    }
  }

  return {
    total: files.length,
    pending: files.filter(f => f.processing_status === 'pending').length,
    processing: files.filter(f => f.processing_status === 'processing').length,
    completed: files.filter(f => f.processing_status === 'completed').length,
    failed: files.filter(f => f.processing_status === 'failed').length,
    skipped: files.filter(f => f.processing_status === 'skipped').length,
    byDomain,
  }
}
