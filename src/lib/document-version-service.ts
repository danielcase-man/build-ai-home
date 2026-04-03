/**
 * Document Version Tracking Service
 *
 * Manages document versioning using the existing `is_current` and
 * `superseded_by` columns on the documents table. Groups documents
 * by name/category and tracks which version is current.
 */

import { supabase } from './supabase'

export interface DocumentVersion {
  id: string
  name: string
  category: string
  file_url: string
  file_type: string
  version: number
  isCurrent: boolean
  supersededBy: string | null
  uploadDate: string
}

export interface DocumentGroup {
  baseName: string
  category: string
  currentVersion: DocumentVersion | null
  allVersions: DocumentVersion[]
  totalVersions: number
}

/**
 * Parse version number from a document name.
 * Handles: REV3, v2, (002), date patterns, _v2, -rev3
 */
function parseDocVersion(name: string): number {
  const patterns = [
    /REV\s*(\d+)/i,
    /[_\-\s]v(\d+)/i,
    /\((\d+)\)/,
    /version\s*(\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = name.match(pattern)
    if (match) return parseInt(match[1], 10)
  }

  // Date-based: extract date from name
  const dateMatch = name.match(/(\d{2})-(\d{2})-(\d{2,4})/)
  if (dateMatch) {
    const [, a, b, c] = dateMatch
    // Convert to sortable number
    if (c.length === 4) return parseInt(c + a + b, 10) // MM-DD-YYYY
    return parseInt('20' + a + b + c, 10) // Assume 20XX for 2-digit year
  }

  return 0
}

/**
 * Strip version markers from a name to get the "base" document name.
 */
function getBaseName(name: string): string {
  return name
    .replace(/\s*REV\s*\d*/i, '')
    .replace(/\s*[_\-]?v\d+/i, '')
    .replace(/\s*\(\d+\)/g, '')
    .replace(/\s*\(version\s*\d+\)/i, '')
    .replace(/\s*\d{2}-\d{2}-\d{2,4}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Get all documents grouped by base name with version tracking.
 */
export async function getDocumentGroups(projectId: string): Promise<DocumentGroup[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, name, category, file_url, file_type, is_current, superseded_by, upload_date, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  // Group by baseName + category
  const groups = new Map<string, DocumentVersion[]>()

  for (const doc of data) {
    const baseName = getBaseName(doc.name)
    const version = parseDocVersion(doc.name)
    const key = `${baseName}::${doc.category || 'Uncategorized'}`

    const entry: DocumentVersion = {
      id: doc.id,
      name: doc.name,
      category: doc.category || 'Uncategorized',
      file_url: doc.file_url || '',
      file_type: doc.file_type || '',
      version,
      isCurrent: doc.is_current !== false, // default true if null
      supersededBy: doc.superseded_by || null,
      uploadDate: doc.upload_date || doc.created_at || '',
    }

    const existing = groups.get(key) || []
    existing.push(entry)
    groups.set(key, existing)
  }

  // Build result
  const result: DocumentGroup[] = []

  for (const [key, versions] of groups) {
    const [baseName, category] = key.split('::')

    // Sort by version descending
    versions.sort((a, b) => b.version - a.version)

    // Current version = highest version that's marked current (or just highest)
    const current = versions.find(v => v.isCurrent) || versions[0]

    result.push({
      baseName,
      category,
      currentVersion: current,
      allVersions: versions,
      totalVersions: versions.length,
    })
  }

  // Sort groups by category then name
  result.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.baseName.localeCompare(b.baseName)
  })

  return result
}

/**
 * Mark a specific document version as superseded by a newer one.
 */
export async function supersedDocument(
  oldDocId: string,
  newDocId: string
): Promise<boolean> {
  const { error: err1 } = await supabase
    .from('documents')
    .update({ is_current: false, superseded_by: newDocId, updated_at: new Date().toISOString() })
    .eq('id', oldDocId)

  const { error: err2 } = await supabase
    .from('documents')
    .update({ is_current: true, updated_at: new Date().toISOString() })
    .eq('id', newDocId)

  return !err1 && !err2
}

/**
 * Get document stats for the project.
 */
export async function getDocumentStats(projectId: string): Promise<{
  total: number
  byCategory: Record<string, number>
  withVersions: number
  currentOnly: number
}> {
  const groups = await getDocumentGroups(projectId)

  const byCategory: Record<string, number> = {}
  let total = 0
  let withVersions = 0

  for (const group of groups) {
    total += group.allVersions.length
    byCategory[group.category] = (byCategory[group.category] || 0) + group.allVersions.length
    if (group.totalVersions > 1) withVersions++
  }

  return {
    total,
    byCategory,
    withVersions,
    currentOnly: groups.length,
  }
}
