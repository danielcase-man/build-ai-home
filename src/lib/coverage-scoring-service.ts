/**
 * Coverage Scoring Service — Phase 4 of the Coverage Pipeline.
 *
 * Computes bid coverage scores by comparing coverage_matches against
 * takeoff items. Answers "how much of what the house needs does this bid cover?"
 *
 * Three levels of scoring:
 *   1. scoreBidCoverage()         — single bid vs single takeoff run
 *   2. scoreCategoryBids()        — all bids for a category vs its takeoff
 *   3. getProjectCoverageSummary() — all categories across the project
 */

import { supabase } from './supabase'
import { getCategoryMapping, getAllCategoryMappings } from './category-mapping'
import type {
  TakeoffItem,
  BidLineItem,
  CoverageMatch,
  BidCoverageScore,
  CategoryCoverageSummary,
} from '@/types'

// ─── Single Bid Scoring ────────────────────────────────────────────────────

/**
 * Score a single bid's coverage against a takeoff run.
 *
 * Queries coverage_matches (where status != 'rejected'), takeoff_items,
 * bid_line_items, and the bid record itself to compute the full BidCoverageScore.
 */
export async function scoreBidCoverage(
  projectId: string,
  bidId: string,
  takeoffRunId: string
): Promise<BidCoverageScore> {
  // Parallel queries for all needed data
  const [matchesRes, takeoffRes, bidLineRes, bidRes] = await Promise.all([
    supabase
      .from('coverage_matches')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'rejected'),
    supabase
      .from('takeoff_items')
      .select('*')
      .eq('takeoff_run_id', takeoffRunId),
    supabase
      .from('bid_line_items')
      .select('*')
      .eq('bid_id', bidId),
    supabase
      .from('bids')
      .select('vendor_name, category, total_amount, bid_date')
      .eq('id', bidId)
      .single(),
  ])

  const allMatches = (matchesRes.data || []) as CoverageMatch[]
  const takeoffItems = (takeoffRes.data || []) as TakeoffItem[]
  const bidLineItems = (bidLineRes.data || []) as BidLineItem[]
  const bid = bidRes.data as { vendor_name: string; category: string; total_amount: number; bid_date: string } | null

  const vendorName = bid?.vendor_name || 'Unknown'
  const category = bid?.category || 'Unknown'
  const bidTotal = bid?.total_amount || 0
  const bidDate = bid?.bid_date || ''

  // Build lookup maps
  const takeoffById = new Map(takeoffItems.map(i => [i.id, i]))
  const bidLineById = new Map(bidLineItems.map(i => [i.id, i]))
  const takeoffIdSet = new Set(takeoffItems.map(i => i.id))
  const bidLineIdSet = new Set(bidLineItems.map(i => i.id))

  // Filter matches to only those involving this bid's line items AND this takeoff's items
  const relevantMatches = allMatches.filter(
    m => takeoffIdSet.has(m.takeoff_item_id) && bidLineIdSet.has(m.bid_line_item_id)
  )

  const matchedTakeoffIds = new Set(relevantMatches.map(m => m.takeoff_item_id))
  const matchedBidLineIds = new Set(relevantMatches.map(m => m.bid_line_item_id))

  const matchedItems = matchedTakeoffIds.size
  const missingItems = takeoffItems.length - matchedItems
  const extraItems = bidLineItems.length - matchedBidLineIds.size
  const takeoffItemCount = takeoffItems.length
  const coveragePct = takeoffItemCount > 0
    ? Math.round((matchedItems / takeoffItemCount) * 10000) / 100
    : 0

  // Sum takeoff costs
  const takeoffTotal = takeoffItems.reduce(
    (sum, item) => sum + (item.total_cost || 0), 0
  )

  const priceVariance = bidTotal - takeoffTotal

  // Build match details
  const matchDetails = relevantMatches.map(m => {
    const ti = takeoffById.get(m.takeoff_item_id)
    const bi = bidLineById.get(m.bid_line_item_id)
    return {
      takeoffItemName: ti?.item_name || '',
      takeoffRoom: ti?.room || '',
      bidItemName: bi?.item_name || '',
      bidItemPrice: bi?.total_price || 0,
      confidence: m.match_confidence,
      matchType: m.match_type,
    }
  })

  // Build missing item details (takeoff items not matched by this bid)
  const missingItemDetails = takeoffItems
    .filter(ti => !matchedTakeoffIds.has(ti.id))
    .map(ti => ({
      takeoffItemName: ti.item_name,
      takeoffRoom: ti.room || '',
      estimatedCost: ti.total_cost || 0,
    }))

  // Determine if this is the latest version from this vendor for this category
  const latestVersion = await isLatestBidVersion(bidId, vendorName, category)

  return {
    bidId,
    vendorName,
    category,
    bidTotal,
    bidDate,
    coveragePct,
    matchedItems,
    missingItems,
    extraItems,
    takeoffTotal,
    priceVariance,
    latestVersion,
    matchDetails,
    missingItemDetails,
  }
}

/**
 * Check whether a bid is the most recent from its vendor for its category.
 */
async function isLatestBidVersion(
  bidId: string,
  vendorName: string,
  category: string
): Promise<boolean> {
  const { data } = await supabase
    .from('bids')
    .select('id')
    .eq('vendor_name', vendorName)
    .eq('category', category)
    .order('bid_date', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return true
  return data[0].id === bidId
}

// ─── Category-Level Scoring ────────────────────────────────────────────────

/**
 * Score all bids for a given selection category against its takeoff run.
 *
 * Returns a CategoryCoverageSummary with per-bid scores, universal gaps
 * (takeoff items not matched by ANY bid), and the best-coverage bid.
 */
export async function scoreCategoryBids(
  projectId: string,
  selectionCategory: string
): Promise<CategoryCoverageSummary | null> {
  const mapping = getCategoryMapping(selectionCategory)
  if (!mapping) return null

  // Get current takeoff run for this trade
  const { data: takeoffRuns } = await supabase
    .from('takeoff_runs')
    .select('id')
    .eq('project_id', projectId)
    .eq('trade', mapping.knowledgeTrade)
    .neq('status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!takeoffRuns || takeoffRuns.length === 0) return null
  const takeoffRunId = takeoffRuns[0].id as string

  // Get takeoff items for this run (needed for summary stats and gap detection)
  const { data: takeoffData } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('takeoff_run_id', takeoffRunId)

  const takeoffItems = (takeoffData || []) as TakeoffItem[]

  // Get all bids for this bid category
  const { data: bids } = await supabase
    .from('bids')
    .select('id')
    .eq('project_id', projectId)
    .eq('category', mapping.bidCategory)

  // Build takeoff items array for drill-down view
  const takeoffItemsForUI = takeoffItems.map(ti => ({
    id: ti.id,
    name: ti.item_name,
    room: ti.room || '',
    materialSpec: ti.material_spec || '',
    quantity: ti.quantity,
    unit: ti.unit,
    unitCost: ti.unit_cost ?? 0,
    totalCost: ti.total_cost ?? (ti.unit_cost ?? 0) * ti.quantity,
  }))

  if (!bids || bids.length === 0) {
    // No bids — return summary with zero scores
    const takeoffTotalCost = takeoffItems.reduce(
      (sum, item) => sum + (item.total_cost || 0), 0
    )
    return {
      category: mapping.bidCategory,
      selectionCategory: mapping.selectionCategory,
      trade: mapping.knowledgeTrade,
      phase: mapping.phase,
      takeoffItemCount: takeoffItems.length,
      takeoffTotalCost,
      bidCount: 0,
      bestCoverageBid: null,
      gapCount: takeoffItems.length,
      gapItems: takeoffItems.map(ti => ({
        name: ti.item_name,
        room: ti.room || '',
        estimatedCost: ti.total_cost || 0,
      })),
      scores: [],
      takeoffItems: takeoffItemsForUI,
    }
  }

  // Score each bid against the takeoff
  const scores: BidCoverageScore[] = []
  for (const bid of bids) {
    const score = await scoreBidCoverage(projectId, bid.id as string, takeoffRunId)
    scores.push(score)
  }

  // Sort by coverage percentage descending
  scores.sort((a, b) => b.coveragePct - a.coveragePct)

  // Find universal gaps — takeoff items not matched by ANY bid
  // Collect all matched takeoff item IDs across all bids
  const allMatchedTakeoffIds = new Set<string>()
  for (const score of scores) {
    for (const detail of score.matchDetails) {
      // Find the takeoff item by name+room to get its ID
      const matchedItem = takeoffItems.find(
        ti => ti.item_name === detail.takeoffItemName &&
          (ti.room || '') === detail.takeoffRoom
      )
      if (matchedItem) {
        allMatchedTakeoffIds.add(matchedItem.id)
      }
    }
  }

  const gapItems = takeoffItems
    .filter(ti => !allMatchedTakeoffIds.has(ti.id))
    .map(ti => ({
      name: ti.item_name,
      room: ti.room || '',
      estimatedCost: ti.total_cost || 0,
    }))

  const takeoffTotalCost = takeoffItems.reduce(
    (sum, item) => sum + (item.total_cost || 0), 0
  )

  const bestCoverageBid = scores.length > 0
    ? {
        vendorName: scores[0].vendorName,
        coveragePct: scores[0].coveragePct,
        bidTotal: scores[0].bidTotal,
      }
    : null

  return {
    category: mapping.bidCategory,
    selectionCategory: mapping.selectionCategory,
    trade: mapping.knowledgeTrade,
    phase: mapping.phase,
    takeoffItemCount: takeoffItems.length,
    takeoffTotalCost,
    bidCount: scores.length,
    bestCoverageBid,
    gapCount: gapItems.length,
    gapItems,
    scores,
    takeoffItems: takeoffItemsForUI,
  }
}

// ─── Project-Level Scoring ─────────────────────────────────────────────────

/**
 * Get coverage summaries for all mapped categories in the project.
 * Only includes categories that have an active takeoff run.
 * Results are sorted by phase then category name.
 */
export async function getProjectCoverageSummary(
  projectId: string
): Promise<CategoryCoverageSummary[]> {
  const mappings = getAllCategoryMappings()
  const summaries: CategoryCoverageSummary[] = []

  for (const mapping of mappings) {
    const summary = await scoreCategoryBids(projectId, mapping.selectionCategory)
    if (summary) {
      summaries.push(summary)
    }
  }

  // Sort by phase first, then category name
  summaries.sort((a, b) => {
    if (a.phase !== b.phase) return a.phase - b.phase
    return a.category.localeCompare(b.category)
  })

  return summaries
}
