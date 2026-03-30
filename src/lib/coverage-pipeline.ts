/**
 * Coverage Pipeline Orchestrator — Phase 6.
 *
 * Single entry point that runs the full takeoff-to-coverage pipeline:
 *   1. Generate takeoff from selections (takeoff-generator-service)
 *   2. Normalize bid line items from JSONB (bid-reextraction-service)
 *   3. Match bid line items to takeoff items (coverage-matching-service)
 *   4. Score coverage metrics (coverage-scoring-service)
 *
 * Can run for a single category or all mapped categories.
 * Errors in one category do not block others.
 */

import { getAllCategoryMappings, getCategoryMapping } from './category-mapping'
import { generateFinishTakeoff } from './takeoff-generator-service'
import { normalizeExistingLineItems } from './bid-reextraction-service'
import { matchAllBidsForCategory } from './coverage-matching-service'
import { scoreCategoryBids } from './coverage-scoring-service'
import type { CategoryCoverageSummary } from '@/types'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PipelineResult {
  category: string
  takeoffItems: number
  bidLineItems: number
  matchesCreated: number
  coverageSummary: CategoryCoverageSummary | null
  errors: string[]
  durationMs: number
}

// Track whether normalization has been run in this pipeline invocation
let normalizedThisRun = false

// ─── Single Category Pipeline ──────────────────────────────────────────────

async function runCategoryPipeline(
  projectId: string,
  selectionCategory: string,
  options?: { force?: boolean }
): Promise<PipelineResult> {
  const start = Date.now()
  const errors: string[] = []
  let takeoffItems = 0
  let bidLineItems = 0
  let matchesCreated = 0
  let coverageSummary: CategoryCoverageSummary | null = null

  const mapping = getCategoryMapping(selectionCategory)
  if (!mapping) {
    return {
      category: selectionCategory,
      takeoffItems: 0,
      bidLineItems: 0,
      matchesCreated: 0,
      coverageSummary: null,
      errors: [`No category mapping found for: ${selectionCategory}`],
      durationMs: Date.now() - start,
    }
  }

  // Step 1: Generate takeoff from selections
  try {
    const run = await generateFinishTakeoff(projectId, selectionCategory)
    if (run) {
      // Count items via the run — we import supabase lazily to avoid
      // adding a direct dependency (tests mock the service)
      const { supabase } = await import('./supabase')
      const { data } = await supabase
        .from('takeoff_items')
        .select('id')
        .eq('takeoff_run_id', run.id)
      takeoffItems = data?.length || 0
    }
  } catch (err) {
    errors.push(`Takeoff generation: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Step 2: Normalize existing JSONB line items (only first time per pipeline run)
  if (!normalizedThisRun) {
    try {
      const normResult = await normalizeExistingLineItems(projectId)
      if (normResult.errors.length > 0) {
        errors.push(...normResult.errors.map(e => `Normalization: ${e}`))
      }
      normalizedThisRun = true
    } catch (err) {
      errors.push(`Normalization: ${err instanceof Error ? err.message : String(err)}`)
      normalizedThisRun = true // Don't retry on subsequent categories
    }
  }

  // Step 3: Match bid line items to takeoff items
  try {
    const matchResults = await matchAllBidsForCategory(
      projectId,
      selectionCategory,
      { force: options?.force }
    )
    for (const mr of matchResults) {
      bidLineItems += mr.matches.length + mr.extraBidItemCount
      matchesCreated += mr.matchedCount
    }
  } catch (err) {
    errors.push(`Matching: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Step 4: Score coverage
  try {
    coverageSummary = await scoreCategoryBids(projectId, selectionCategory)
  } catch (err) {
    errors.push(`Scoring: ${err instanceof Error ? err.message : String(err)}`)
  }

  return {
    category: mapping.bidCategory,
    takeoffItems,
    bidLineItems,
    matchesCreated,
    coverageSummary,
    errors,
    durationMs: Date.now() - start,
  }
}

// ─── Main Entry Point ──────────────────────────────────────────────────────

/**
 * Run the full coverage pipeline.
 *
 * @param projectId — the project to process
 * @param selectionCategory — if provided, run for one category only;
 *   otherwise run for all mapped categories
 * @param options.force — if true, force re-matching even if matches exist
 */
export async function runCoveragePipeline(
  projectId: string,
  selectionCategory?: string,
  options?: { force?: boolean }
): Promise<PipelineResult[]> {
  // Reset normalization flag for this pipeline run
  normalizedThisRun = false

  if (selectionCategory) {
    // Single category
    const result = await runCategoryPipeline(projectId, selectionCategory, options)
    return [result]
  }

  // All categories
  const mappings = getAllCategoryMappings()
  const results: PipelineResult[] = []

  for (const mapping of mappings) {
    const result = await runCategoryPipeline(
      projectId,
      mapping.selectionCategory,
      options
    )
    results.push(result)
  }

  return results
}
