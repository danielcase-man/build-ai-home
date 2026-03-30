/**
 * Takeoff Generator Service — converts selections into takeoff items.
 *
 * Phase 1 of the coverage pipeline. Selections define what the house needs
 * (the "denominator" for bid comparison). This service maps each selection
 * into a structured takeoff item, grouped into runs by trade.
 *
 * Flow: selections → generateFinishTakeoff() → takeoff_runs + takeoff_items
 */

import { getSelectionsByCategory } from './selections-service'
import { getCategoryMapping, getAllCategoryMappings } from './category-mapping'
import {
  createTakeoffRun,
  insertTakeoffItems,
  getTakeoffRuns,
  updateTakeoffRunStatus,
  getTakeoffRunWithItems,
} from './takeoff-service'
import type {
  TakeoffRun,
  TakeoffItem,
  TakeoffRunWithItems,
  TakeoffItemSource,
  TakeoffItemConfidence,
} from '@/types'

// ---------------------------------------------------------------------------
// Single-category takeoff generation
// ---------------------------------------------------------------------------

/**
 * Generate a takeoff run from selections in a single category.
 *
 * Steps:
 * 1. Load selections for the category
 * 2. Resolve the category → trade mapping
 * 3. Supersede any existing takeoff run for the trade
 * 4. Create a new run and insert items mapped from selections
 */
export async function generateFinishTakeoff(
  projectId: string,
  selectionCategory: string
): Promise<TakeoffRun | null> {
  // 1. Get selections
  const selections = await getSelectionsByCategory(projectId, selectionCategory)
  if (selections.length === 0) return null

  // 2. Resolve mapping
  const mapping = getCategoryMapping(selectionCategory)
  if (!mapping) {
    console.error(`No category mapping for selection category: ${selectionCategory}`)
    return null
  }

  const trade = mapping.knowledgeTrade

  // 3. Supersede existing run for this trade
  const existingRuns = await getTakeoffRuns(projectId, { trade })
  const activeRun = existingRuns.find(r => r.status !== 'superseded')
  if (activeRun) {
    await updateTakeoffRunStatus(activeRun.id, 'superseded')
  }

  // 4. Create new run
  const run = await createTakeoffRun({
    project_id: projectId,
    trade,
    name: `${trade} — Finish Selections`,
    description: `Auto-generated from ${selections.length} ${selectionCategory} selections`,
    confidence_pct: 100,
    gaps: [],
    status: 'final',
  })

  if (!run) {
    console.error(`Failed to create takeoff run for trade: ${trade}`)
    return null
  }

  // 5. Map selections to takeoff items
  const items = selections.map((sel) => ({
    takeoff_run_id: run.id,
    project_id: projectId,
    category: sel.category,
    trade,
    item_name: sel.product_name,
    description: [sel.brand, sel.collection, sel.finish, sel.color]
      .filter(Boolean)
      .join(' — ') || undefined,
    material_spec: [sel.brand, sel.model_number]
      .filter(Boolean)
      .join(' ') || undefined,
    quantity: sel.quantity || 1,
    unit: 'EA',
    unit_cost: sel.unit_price,
    source: 'vendor_spec' as TakeoffItemSource,
    confidence: 'verified' as TakeoffItemConfidence,
    source_detail: `Selection: ${sel.room} — ${sel.product_name}`,
    selection_id: sel.id,
    room: sel.room,
  }))

  // total_cost and quantity_with_waste are GENERATED columns in DB —
  // do NOT include them in the insert. They auto-compute from unit_cost + quantity.
  const insertResult = await insertTakeoffItems(items)
  if (insertResult.errors.length > 0) {
    console.error(`[takeoff-gen] Insert errors for ${trade}:`, insertResult.errors)
  }
  console.log(`[takeoff-gen] ${trade}: ${insertResult.inserted} items inserted from ${selections.length} selections`)

  return run
}

// ---------------------------------------------------------------------------
// All-categories takeoff generation
// ---------------------------------------------------------------------------

/**
 * Generate takeoff runs for every mapped selection category.
 * Returns all created runs and the total item count.
 */
export async function generateAllFinishTakeoffs(
  projectId: string
): Promise<{ runs: TakeoffRun[]; totalItems: number }> {
  const mappings = getAllCategoryMappings()
  const runs: TakeoffRun[] = []
  let totalItems = 0

  for (const mapping of mappings) {
    const run = await generateFinishTakeoff(projectId, mapping.selectionCategory)
    if (run) {
      runs.push(run)
      // Count items from the selections that were just processed
      const selections = await getSelectionsByCategory(projectId, mapping.selectionCategory)
      totalItems += selections.length
    }
  }

  return { runs, totalItems }
}

// ---------------------------------------------------------------------------
// Current takeoff lookup
// ---------------------------------------------------------------------------

/**
 * Get the latest non-superseded takeoff run (with items) for a trade.
 */
export async function getCurrentTakeoff(
  projectId: string,
  trade: string
): Promise<TakeoffRunWithItems | null> {
  const runs = await getTakeoffRuns(projectId, { trade })
  const activeRun = runs.find(r => r.status !== 'superseded')
  if (!activeRun) return null

  return getTakeoffRunWithItems(activeRun.id)
}
