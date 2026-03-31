/**
 * Plan Discovery Service
 *
 * Queries the file_inventory table to find the latest version of each plan type.
 * Uses filename pattern matching and version parsing to identify and rank plans.
 */

import { supabase } from './supabase'
import type { PlanSource } from '@/types'

// All plan types from PlanSource['type']
export const ALL_PLAN_TYPES: PlanSource['type'][] = [
  'architectural', 'structural', 'foundation', 'detail',
  'site', 'electrical', 'mechanical', 'plumbing',
]

export interface DiscoveredPlan {
  fileId: string
  filePath: string
  fileName: string
  planType: PlanSource['type']
  version: number
  versionLabel: string
  modifiedAt: string
  confidence: number
}

export interface PlanDiscoveryResult {
  plans: Record<string, DiscoveredPlan>  // latest per plan type
  allVersions: DiscoveredPlan[]
  missingTypes: string[]
}

// ─── Classification ──────────────────────────────────────────────────────────

interface ClassificationResult {
  planType: PlanSource['type'] | null
  confidence: number
}

// Exclusion patterns — these files are never plans
const EXCLUSION_PATTERNS = [
  /PDS/i,
  /Installation Guide/i,
  /Installation Manual/i,
  /Invoice/i,
  /Receipt/i,
  /Agreement/i,
  /Consulting Services/i,
  /Docusign/i,
  /Application/i,
]

// Classification rules in priority order
const CLASSIFICATION_RULES: Array<{
  pattern: RegExp
  planType: PlanSource['type']
  confidence: number
}> = [
  { pattern: /foundation|footing/i, planType: 'foundation', confidence: 0.95 },
  { pattern: /structural|main house|rv garage|rafter|framing/i, planType: 'structural', confidence: 0.90 },
  { pattern: /grading|drainage|civil|site plan|topo/i, planType: 'site', confidence: 0.90 },
  { pattern: /electrical|PEC|service packet/i, planType: 'electrical', confidence: 0.85 },
  { pattern: /OSSF|septic|plumbing(?! fixture)/i, planType: 'plumbing', confidence: 0.85 },
  { pattern: /elevation|section|floor.?plan|architectural/i, planType: 'architectural', confidence: 0.85 },
  { pattern: /detail|assembly|transition/i, planType: 'detail', confidence: 0.80 },
]

/**
 * Classify a file as a specific plan type based on filename and folder.
 * Returns null planType for non-plan files.
 */
export function classifyPlanFile(
  fileName: string,
  folderCategory?: string
): ClassificationResult {
  // Check exclusions first
  for (const pattern of EXCLUSION_PATTERNS) {
    if (pattern.test(fileName)) {
      return { planType: null, confidence: 0 }
    }
  }

  // Try classification rules (first match wins)
  const searchText = folderCategory ? `${fileName} ${folderCategory}` : fileName

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(searchText)) {
      return { planType: rule.planType, confidence: rule.confidence }
    }
  }

  return { planType: null, confidence: 0 }
}

// ─── Version Parsing ─────────────────────────────────────────────────────────

interface VersionResult {
  version: number
  label: string
}

/**
 * Parse version information from a filename.
 * Returns a numeric version (higher = newer) and a human-readable label.
 */
export function parseVersion(fileName: string): VersionResult {
  // 1. REV followed by a number: "REV3" → version 3
  const revNum = fileName.match(/REV(\d+)/i)
  if (revNum) {
    return { version: parseInt(revNum[1], 10), label: `REV${revNum[1]}` }
  }

  // 2. REV alone (no number): "REV" → version 1
  if (/REV\b/i.test(fileName)) {
    return { version: 1, label: 'REV' }
  }

  // 3. v followed by a number: "v2" → version 2
  const vNum = fileName.match(/[vV](\d+)/)
  if (vNum) {
    return { version: parseInt(vNum[1], 10), label: `v${vNum[1]}` }
  }

  // 4. "(version N)": "(version 1)" → version 1
  // Check this BEFORE the bare parenthesized number to avoid ambiguity
  const versionWord = fileName.match(/\(version\s+(\d+)\)/i)
  if (versionWord) {
    return { version: parseInt(versionWord[1], 10), label: `version ${versionWord[1]}` }
  }

  // 5. "(N)" — parenthesized number, but NOT if preceded by a date pattern
  const parenNum = fileName.match(/\((\d+)\)/)
  if (parenNum) {
    // Check that this isn't part of a date-like context (e.g., "10-06-25 (2)")
    // We accept it as a version number
    const n = parseInt(parenNum[1], 10)
    return { version: n, label: `(${n})` }
  }

  // 6. Date pattern: MM-DD-YY, MM-DD-YYYY, or YY-MM-DD
  const dateMatch = fileName.match(/(\d{2})-(\d{2})-(\d{2,4})/)
  if (dateMatch) {
    const [, a, b, c] = dateMatch
    let year: number, month: number, day: number

    if (c.length === 4) {
      // MM-DD-YYYY
      month = parseInt(a, 10)
      day = parseInt(b, 10)
      year = parseInt(c, 10)
    } else {
      const aNum = parseInt(a, 10)
      const bNum = parseInt(b, 10)
      const cNum = parseInt(c, 10)

      if (aNum > 12) {
        // YY-MM-DD (year first since >12 can't be a month)
        year = 2000 + aNum
        month = bNum
        day = cNum
      } else {
        // MM-DD-YY (default assumption)
        month = aNum
        day = bNum
        year = 2000 + cNum
      }
    }

    const dateVersion = year * 10000 + month * 100 + day
    return { version: dateVersion, label: `${a}-${b}-${c}` }
  }

  // 7. No version marker
  return { version: 0, label: 'original' }
}

// ─── Discovery ───────────────────────────────────────────────────────────────

/**
 * Discover the latest version of each plan type from file_inventory.
 */
export async function discoverLatestPlans(
  projectId: string
): Promise<PlanDiscoveryResult> {
  const { data, error } = await supabase
    .from('file_inventory')
    .select('*')
    .eq('project_id', projectId)
    .eq('agent_domain', 'takeoff')
    .in('file_type', ['pdf', 'png', 'jpg', 'jpeg'])

  if (error) {
    return { plans: {}, allVersions: [], missingTypes: [...ALL_PLAN_TYPES] }
  }

  const files = data || []
  const allVersions: DiscoveredPlan[] = []

  // Classify and version each file
  for (const file of files) {
    const classification = classifyPlanFile(file.file_name, file.folder_category)
    if (!classification.planType) continue

    const versionInfo = parseVersion(file.file_name)

    allVersions.push({
      fileId: file.id,
      filePath: file.file_path,
      fileName: file.file_name,
      planType: classification.planType,
      version: versionInfo.version,
      versionLabel: versionInfo.label,
      modifiedAt: file.modified_at,
      confidence: classification.confidence,
    })
  }

  // Group by planType, pick highest version per type
  const plans: Record<string, DiscoveredPlan> = {}
  for (const plan of allVersions) {
    const existing = plans[plan.planType]
    if (!existing || plan.version > existing.version) {
      plans[plan.planType] = plan
    }
  }

  // Determine missing types
  const foundTypes = new Set(Object.keys(plans))
  const missingTypes = ALL_PLAN_TYPES.filter(t => !foundTypes.has(t))

  return { plans, allVersions, missingTypes }
}
