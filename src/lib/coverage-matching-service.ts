/**
 * Coverage Matching Service
 *
 * Three-tier matching engine that links bid line items to takeoff items:
 *   Tier 1 — Deterministic: model number, name+room, brand+category+room
 *   Tier 2 — Fuzzy deterministic: Jaccard token similarity + room/category/quantity
 *   Tier 3 — AI-inferred: Claude matches remaining unmatched pairs by function/purpose
 *
 * The takeoff items are the "denominator" — what the house needs.
 * Bid line items are the "numerator" — what vendors quoted.
 * Coverage = matched takeoff items / total takeoff items.
 */

import { supabase } from './supabase'
import { getCategoryMapping } from './category-mapping'
import type { TakeoffItem, BidLineItem, CoverageMatch } from '@/types'

// ─── Result Types ────────────────────────────────────────────────────────────

export interface BidMatchResult {
  bidId: string
  vendorName: string
  takeoffRunId: string
  category: string
  totalTakeoffItems: number
  matchedCount: number
  unmatchedTakeoffCount: number
  extraBidItemCount: number
  matches: Array<{
    takeoffItemId: string
    bidLineItemId: string
    takeoffItemName: string
    bidItemName: string
    matchType: CoverageMatch['match_type']
    confidence: number
    reasoning?: string
  }>
  unmatchedTakeoffItems: Array<{ id: string; name: string; room: string }>
  extraBidItems: Array<{ id: string; name: string; room?: string }>
}

// Internal match result from each tier
interface MatchEntry {
  bidItemId: string
  type: CoverageMatch['match_type']
  confidence: number
  reasoning: string
}

// ─── Normalization Helpers ───────────────────────────────────────────────────

const FILLER_WORDS = new Set(['a', 'an', 'the', 'w/', 'w', 'with', 'for', 'and', 'or', 'in', 'of'])

/** Lowercase, trim, remove punctuation except hyphens in model numbers */
function normalizeName(name: string | undefined | null): string {
  if (!name) return ''
  return name.toLowerCase().trim().replace(/[^a-z0-9\s\-/]/g, '').replace(/\s+/g, ' ')
}

/** Split into token set, removing filler words */
function tokenize(name: string): Set<string> {
  const normalized = normalizeName(name)
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0 && !FILLER_WORDS.has(t))
  return new Set(tokens)
}

/** Normalize room names for comparison */
function normalizeRoom(room: string | undefined | null): string {
  if (!room) return ''
  return room.toLowerCase().trim()
}

/** Check if rooms are compatible (match, or one is null/whole house) */
function roomsCompatible(
  roomA: string | undefined | null,
  roomB: string | undefined | null
): boolean {
  const a = normalizeRoom(roomA)
  const b = normalizeRoom(roomB)
  // If either is empty or "whole house", they're compatible
  if (!a || !b) return true
  if (a === 'whole house' || b === 'whole house') return true
  return a === b
}

/** Check if rooms strictly match (both non-null, same value) or one is universal */
function roomsMatch(
  roomA: string | undefined | null,
  roomB: string | undefined | null
): boolean {
  const a = normalizeRoom(roomA)
  const b = normalizeRoom(roomB)
  if (!a || !b) return true
  if (a === 'whole house' || b === 'whole house') return true
  return a === b
}

/**
 * Parse model number from material_spec.
 * Format is typically "Brand ModelNumber" or just "ModelNumber".
 * e.g., "Newport Brass 2470-5103/04" → "2470-5103/04"
 */
function parseModelNumber(materialSpec: string | undefined | null): string | null {
  if (!materialSpec) return null
  const trimmed = materialSpec.trim()
  if (!trimmed) return null

  // Model numbers typically contain digits + hyphens/slashes
  // Try to find the last token that looks like a model number
  const tokens = trimmed.split(/\s+/)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    // A model number should contain at least one digit and some non-alpha chars
    if (/\d/.test(token) && /[-/.]/.test(token)) {
      return token
    }
    // Also match pure alphanumeric model numbers like "ABC123"
    if (/\d/.test(token) && /[a-zA-Z]/.test(token) && token.length >= 4) {
      return token
    }
  }

  // Last resort: if the whole spec looks like a model number
  if (/\d/.test(trimmed) && tokens.length <= 2) {
    return tokens[tokens.length - 1]
  }

  return null
}

/** Compute Jaccard similarity between two token sets */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }
  const union = setA.size + setB.size - intersection
  if (union === 0) return 0
  return intersection / union
}

/** Compute token overlap ratio (intersection / smaller set) */
function tokenOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }
  return intersection / Math.min(setA.size, setB.size)
}

// ─── Tier 1: Deterministic Matching ─────────────────────────────────────────

/**
 * Deterministic matching — no AI needed.
 * 1. Model number exact match (confidence 1.0)
 * 2. Name + room exact match (confidence 0.95)
 * 3. Brand + category + room match (confidence 0.90)
 */
export function tier1DeterministicMatch(
  takeoffItems: TakeoffItem[],
  bidLineItems: BidLineItem[]
): Map<string, MatchEntry> {
  const matches = new Map<string, MatchEntry>()
  const usedBidItems = new Set<string>()

  // Pass 1: Model number exact match
  for (const ti of takeoffItems) {
    if (matches.has(ti.id)) continue
    const tiModel = parseModelNumber(ti.material_spec)
    if (!tiModel) continue

    for (const bi of bidLineItems) {
      if (usedBidItems.has(bi.id)) continue
      if (!bi.model_number) continue

      if (tiModel.toLowerCase() === bi.model_number.toLowerCase()) {
        matches.set(ti.id, {
          bidItemId: bi.id,
          type: 'exact_model',
          confidence: 1.0,
          reasoning: `Model number match: ${tiModel}`,
        })
        usedBidItems.add(bi.id)
        break
      }
    }
  }

  // Pass 2: Name + room exact match
  for (const ti of takeoffItems) {
    if (matches.has(ti.id)) continue
    const tiName = normalizeName(ti.item_name)
    if (!tiName) continue

    for (const bi of bidLineItems) {
      if (usedBidItems.has(bi.id)) continue
      const biName = normalizeName(bi.item_name)
      if (!biName) continue

      if (tiName === biName && roomsMatch(ti.room, bi.room)) {
        matches.set(ti.id, {
          bidItemId: bi.id,
          type: 'name_match',
          confidence: 0.95,
          reasoning: `Exact name match: "${ti.item_name}"${ti.room ? ` in ${ti.room}` : ''}`,
        })
        usedBidItems.add(bi.id)
        break
      }
    }
  }

  // Pass 3: Brand + category + room match
  for (const ti of takeoffItems) {
    if (matches.has(ti.id)) continue

    // Extract brand from material_spec (first word before model number)
    const tiBrand = extractBrand(ti.material_spec)
    if (!tiBrand) continue

    for (const bi of bidLineItems) {
      if (usedBidItems.has(bi.id)) continue
      if (!bi.brand) continue

      const brandsMatch = tiBrand.toLowerCase() === bi.brand.toLowerCase()
      const categoriesMatch = ti.category && bi.category &&
        ti.category.toLowerCase() === bi.category.toLowerCase()
      const roomOk = roomsMatch(ti.room, bi.room)

      if (brandsMatch && categoriesMatch && roomOk) {
        matches.set(ti.id, {
          bidItemId: bi.id,
          type: 'name_match',
          confidence: 0.90,
          reasoning: `Brand+category+room match: ${tiBrand} / ${ti.category}${ti.room ? ` / ${ti.room}` : ''}`,
        })
        usedBidItems.add(bi.id)
        break
      }
    }
  }

  return matches
}

/** Extract brand name from material_spec (everything before the model number) */
function extractBrand(materialSpec: string | undefined | null): string | null {
  if (!materialSpec) return null
  const trimmed = materialSpec.trim()
  if (!trimmed) return null

  const tokens = trimmed.split(/\s+/)
  // Brand is typically the first token(s) before the model-number-like token
  const brandTokens: string[] = []
  for (const token of tokens) {
    // Stop when we hit a model-number-like token
    if (/\d/.test(token) && (/[-/.]/.test(token) || (/[a-zA-Z]/.test(token) && token.length >= 4))) {
      break
    }
    brandTokens.push(token)
  }

  return brandTokens.length > 0 ? brandTokens.join(' ') : null
}

// ─── Tier 2: Fuzzy Deterministic Matching ───────────────────────────────────

/**
 * Fuzzy matching using token similarity — no AI needed.
 * 1. Jaccard similarity > 0.5 with compatible rooms (confidence = similarity * 0.9)
 * 2. Category + quantity match with > 30% token overlap (confidence 0.7)
 */
export function tier2FuzzyMatch(
  unmatchedTakeoff: TakeoffItem[],
  unmatchedBidItems: BidLineItem[]
): Map<string, MatchEntry> {
  const matches = new Map<string, MatchEntry>()
  const usedBidItems = new Set<string>()

  // Score all pairs, pick best matches greedily
  interface ScoredPair {
    takeoffId: string
    bidId: string
    score: number
    entry: MatchEntry
  }

  const candidates: ScoredPair[] = []

  for (const ti of unmatchedTakeoff) {
    const tiTokens = tokenize(ti.item_name)
    if (tiTokens.size === 0) continue

    for (const bi of unmatchedBidItems) {
      const biTokens = tokenize(bi.item_name)
      if (biTokens.size === 0) continue

      const jaccard = jaccardSimilarity(tiTokens, biTokens)
      const overlap = tokenOverlap(tiTokens, biTokens)

      // Strategy 1: High Jaccard + compatible rooms
      if (jaccard >= 0.5 && roomsCompatible(ti.room, bi.room)) {
        const confidence = Math.round(jaccard * 0.9 * 100) / 100
        candidates.push({
          takeoffId: ti.id,
          bidId: bi.id,
          score: confidence,
          entry: {
            bidItemId: bi.id,
            type: 'room_inferred',
            confidence,
            reasoning: `Fuzzy name match (Jaccard=${jaccard.toFixed(2)}): "${ti.item_name}" ↔ "${bi.item_name}"`,
          },
        })
        continue
      }

      // Strategy 2: Category + quantity + partial name overlap
      const categoriesMatch = ti.category && bi.category &&
        ti.category.toLowerCase() === bi.category.toLowerCase()
      const quantitiesMatch = ti.quantity > 0 && bi.quantity > 0 && ti.quantity === bi.quantity

      if (categoriesMatch && quantitiesMatch && overlap > 0.3 && roomsCompatible(ti.room, bi.room)) {
        candidates.push({
          takeoffId: ti.id,
          bidId: bi.id,
          score: 0.7,
          entry: {
            bidItemId: bi.id,
            type: 'name_match',
            confidence: 0.7,
            reasoning: `Category+quantity+partial name match: ${ti.category}, qty=${ti.quantity}, overlap=${(overlap * 100).toFixed(0)}%`,
          },
        })
      }
    }
  }

  // Sort by score descending, then greedily assign (no double-matching)
  candidates.sort((a, b) => b.score - a.score)

  for (const c of candidates) {
    if (matches.has(c.takeoffId) || usedBidItems.has(c.bidId)) continue
    matches.set(c.takeoffId, c.entry)
    usedBidItems.add(c.bidId)
  }

  return matches
}

// ─── Tier 3: AI-Inferred Matching ───────────────────────────────────────────

const AI_BATCH_SIZE = 50

/**
 * AI-powered matching for items that couldn't be matched deterministically.
 * Uses Claude to infer functional equivalences.
 */
export async function tier3AIMatch(
  unmatchedTakeoff: TakeoffItem[],
  unmatchedBidItems: BidLineItem[],
  category: string
): Promise<Map<string, MatchEntry>> {
  const matches = new Map<string, MatchEntry>()

  if (unmatchedTakeoff.length === 0 || unmatchedBidItems.length === 0) {
    return matches
  }

  // Batch to stay within token limits
  const takeoffBatch = unmatchedTakeoff.slice(0, AI_BATCH_SIZE)
  const bidBatch = unmatchedBidItems.slice(0, AI_BATCH_SIZE)

  const takeoffList = takeoffBatch.map(ti =>
    `- ID: ${ti.id} | Name: ${ti.item_name} | Room: ${ti.room || 'N/A'} | Specs: ${ti.material_spec || 'N/A'} | Qty: ${ti.quantity} ${ti.unit}`
  ).join('\n')

  const bidList = bidBatch.map(bi =>
    `- ID: ${bi.id} | Name: ${bi.item_name} | Room: ${bi.room || 'N/A'} | Desc: ${bi.item_description || 'N/A'} | Brand: ${bi.brand || 'N/A'} | Model: ${bi.model_number || 'N/A'} | Qty: ${bi.quantity} ${bi.unit || 'each'}`
  ).join('\n')

  const prompt = `Match these construction takeoff items (what the house needs) to vendor bid line items (what the vendor quoted) for the "${category}" trade.

TAKEOFF ITEMS (the denominator — what's needed):
${takeoffList}

BID LINE ITEMS (vendor's quote):
${bidList}

Rules:
- Each takeoff item can match at most 1 bid item, and vice versa
- Consider room context — "Kitchen" items should match kitchen bid items
- "Whole House" bid items can match any room
- Items don't need to have the same name — match by function/purpose
- If no reasonable match exists, leave unmatched
- Only match items you are reasonably confident about (>0.5 confidence)

Return ONLY a JSON array (no markdown, no explanation):
[{ "takeoff_id": "...", "bid_id": "...", "confidence": 0.0-1.0, "reasoning": "..." }]

If no matches found, return an empty array: []`

  try {
    const { getAnthropicClient, parseAIJsonResponse } = await import('./ai-clients')
    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = parseAIJsonResponse(text) as Array<{
      takeoff_id: string
      bid_id: string
      confidence: number
      reasoning: string
    }>

    if (!Array.isArray(parsed)) return matches

    // Validate and deduplicate
    const usedTakeoff = new Set<string>()
    const usedBid = new Set<string>()
    const validTakeoffIds = new Set(takeoffBatch.map(t => t.id))
    const validBidIds = new Set(bidBatch.map(b => b.id))

    for (const m of parsed) {
      if (!m.takeoff_id || !m.bid_id) continue
      if (!validTakeoffIds.has(m.takeoff_id) || !validBidIds.has(m.bid_id)) continue
      if (usedTakeoff.has(m.takeoff_id) || usedBid.has(m.bid_id)) continue

      const confidence = Math.min(Math.max(m.confidence || 0, 0), 1)
      if (confidence < 0.3) continue

      matches.set(m.takeoff_id, {
        bidItemId: m.bid_id,
        type: 'ai_inferred',
        confidence: Math.round(confidence * 100) / 100,
        reasoning: m.reasoning || 'AI-inferred match',
      })
      usedTakeoff.add(m.takeoff_id)
      usedBid.add(m.bid_id)
    }
  } catch (err) {
    console.error('Tier 3 AI matching failed:', err instanceof Error ? err.message : err)
    console.error('Tier 3 details:', err instanceof Error ? err.stack : 'no stack')
  }

  return matches
}

// ─── Main Entry Points ──────────────────────────────────────────────────────

/**
 * Match a single bid's line items against a takeoff run's items.
 * Runs all three tiers sequentially, collecting matches at each stage.
 */
export async function matchBidToTakeoff(
  projectId: string,
  bidId: string,
  takeoffRunId: string,
  options?: { force?: boolean }
): Promise<BidMatchResult> {
  // Get takeoff items
  const { data: takeoffItems } = await supabase
    .from('takeoff_items')
    .select('*')
    .eq('takeoff_run_id', takeoffRunId)
    .order('sort_order', { ascending: true })

  // Get bid line items
  const { data: bidLineItems } = await supabase
    .from('bid_line_items')
    .select('*')
    .eq('bid_id', bidId)
    .order('sort_order', { ascending: true })

  // Get bid record for vendor name + category
  const { data: bid } = await supabase
    .from('bids')
    .select('vendor_name, category')
    .eq('id', bidId)
    .single()

  const items = (takeoffItems || []) as TakeoffItem[]
  const lineItems = (bidLineItems || []) as BidLineItem[]
  const vendorName = bid?.vendor_name || 'Unknown'
  const category = bid?.category || 'Unknown'

  // Check for existing matches (skip unless force)
  if (!options?.force) {
    const { data: existingMatches } = await supabase
      .from('coverage_matches')
      .select('id')
      .eq('project_id', projectId)
      .in('takeoff_item_id', items.map(i => i.id))
      .in('bid_line_item_id', lineItems.map(i => i.id))
      .limit(1)

    if (existingMatches && existingMatches.length > 0) {
      // Return current state from DB
      return buildResultFromExisting(
        projectId, bidId, takeoffRunId, vendorName, category, items, lineItems
      )
    }
  }

  // Handle edge cases
  if (items.length === 0 || lineItems.length === 0) {
    return {
      bidId,
      vendorName,
      takeoffRunId,
      category,
      totalTakeoffItems: items.length,
      matchedCount: 0,
      unmatchedTakeoffCount: items.length,
      extraBidItemCount: lineItems.length,
      matches: [],
      unmatchedTakeoffItems: items.map(i => ({ id: i.id, name: i.item_name, room: i.room || '' })),
      extraBidItems: lineItems.map(i => ({ id: i.id, name: i.item_name, room: i.room })),
    }
  }

  // ── Tier 1: Deterministic ─────────────────────────────────────────────────
  const tier1Matches = tier1DeterministicMatch(items, lineItems)

  // Compute unmatched after Tier 1
  const matchedTakeoffIds = new Set(tier1Matches.keys())
  const matchedBidIds = new Set([...tier1Matches.values()].map(m => m.bidItemId))

  let unmatchedTakeoff = items.filter(i => !matchedTakeoffIds.has(i.id))
  let unmatchedBid = lineItems.filter(i => !matchedBidIds.has(i.id))

  // ── Tier 2: Fuzzy ─────────────────────────────────────────────────────────
  const tier2Matches = tier2FuzzyMatch(unmatchedTakeoff, unmatchedBid)

  // Update unmatched
  for (const [tiId, entry] of tier2Matches) {
    matchedTakeoffIds.add(tiId)
    matchedBidIds.add(entry.bidItemId)
  }
  unmatchedTakeoff = items.filter(i => !matchedTakeoffIds.has(i.id))
  unmatchedBid = lineItems.filter(i => !matchedBidIds.has(i.id))

  // ── Tier 3: AI ────────────────────────────────────────────────────────────
  let tier3Matches = new Map<string, MatchEntry>()
  if (unmatchedTakeoff.length > 0 && unmatchedBid.length > 0) {
    console.log(`[coverage-match] Tier 3 AI: ${unmatchedTakeoff.length} unmatched takeoff, ${unmatchedBid.length} unmatched bid items for ${category}`)
    tier3Matches = await tier3AIMatch(unmatchedTakeoff, unmatchedBid, category)

    for (const [tiId, entry] of tier3Matches) {
      matchedTakeoffIds.add(tiId)
      matchedBidIds.add(entry.bidItemId)
    }
  }

  // ── Combine all matches ───────────────────────────────────────────────────
  const allMatches = new Map<string, MatchEntry>()
  for (const [k, v] of tier1Matches) allMatches.set(k, v)
  for (const [k, v] of tier2Matches) allMatches.set(k, v)
  for (const [k, v] of tier3Matches) allMatches.set(k, v)

  // Build name lookup maps
  const takeoffById = new Map(items.map(i => [i.id, i]))
  const bidById = new Map(lineItems.map(i => [i.id, i]))

  // ── Persist to coverage_matches ───────────────────────────────────────────
  const rows = [...allMatches.entries()].map(([takeoffItemId, entry]) => {
    const ti = takeoffById.get(takeoffItemId)
    return {
      project_id: projectId,
      takeoff_item_id: takeoffItemId,
      bid_line_item_id: entry.bidItemId,
      selection_id: ti?.selection_id || null,
      match_type: entry.type,
      match_confidence: entry.confidence,
      match_reasoning: entry.reasoning,
      status: 'proposed' as const,
    }
  })

  if (rows.length > 0) {
    // Delete any prior matches for this bid+takeoff pair before inserting
    if (options?.force) {
      await supabase
        .from('coverage_matches')
        .delete()
        .eq('project_id', projectId)
        .in('takeoff_item_id', items.map(i => i.id))
        .in('bid_line_item_id', lineItems.map(i => i.id))
    }

    await supabase
      .from('coverage_matches')
      .upsert(rows, { onConflict: 'takeoff_item_id,bid_line_item_id' })
  }

  // ── Build result ──────────────────────────────────────────────────────────
  const finalUnmatchedTakeoff = items.filter(i => !matchedTakeoffIds.has(i.id))
  const finalExtraBid = lineItems.filter(i => !matchedBidIds.has(i.id))

  const matchArray = [...allMatches.entries()].map(([takeoffItemId, entry]) => {
    const ti = takeoffById.get(takeoffItemId)
    const bi = bidById.get(entry.bidItemId)
    return {
      takeoffItemId,
      bidLineItemId: entry.bidItemId,
      takeoffItemName: ti?.item_name || '',
      bidItemName: bi?.item_name || '',
      matchType: entry.type,
      confidence: entry.confidence,
      reasoning: entry.reasoning,
    }
  })

  return {
    bidId,
    vendorName,
    takeoffRunId,
    category,
    totalTakeoffItems: items.length,
    matchedCount: allMatches.size,
    unmatchedTakeoffCount: finalUnmatchedTakeoff.length,
    extraBidItemCount: finalExtraBid.length,
    matches: matchArray,
    unmatchedTakeoffItems: finalUnmatchedTakeoff.map(i => ({
      id: i.id, name: i.item_name, room: i.room || '',
    })),
    extraBidItems: finalExtraBid.map(i => ({
      id: i.id, name: i.item_name, room: i.room,
    })),
  }
}

/**
 * Build a BidMatchResult from existing coverage_matches in the database.
 * Used when we skip re-matching (matches already exist and force is not set).
 */
async function buildResultFromExisting(
  projectId: string,
  bidId: string,
  takeoffRunId: string,
  vendorName: string,
  category: string,
  takeoffItems: TakeoffItem[],
  bidLineItems: BidLineItem[]
): Promise<BidMatchResult> {
  const takeoffIds = takeoffItems.map(i => i.id)
  const bidIds = bidLineItems.map(i => i.id)

  const { data: existingRows } = await supabase
    .from('coverage_matches')
    .select('*')
    .eq('project_id', projectId)
    .in('takeoff_item_id', takeoffIds)
    .in('bid_line_item_id', bidIds)

  const existing = (existingRows || []) as CoverageMatch[]

  const takeoffById = new Map(takeoffItems.map(i => [i.id, i]))
  const bidById = new Map(bidLineItems.map(i => [i.id, i]))
  const matchedTakeoffIds = new Set(existing.map(m => m.takeoff_item_id))
  const matchedBidIds = new Set(existing.map(m => m.bid_line_item_id))

  return {
    bidId,
    vendorName,
    takeoffRunId,
    category,
    totalTakeoffItems: takeoffItems.length,
    matchedCount: existing.length,
    unmatchedTakeoffCount: takeoffItems.length - matchedTakeoffIds.size,
    extraBidItemCount: bidLineItems.length - matchedBidIds.size,
    matches: existing.map(m => ({
      takeoffItemId: m.takeoff_item_id,
      bidLineItemId: m.bid_line_item_id,
      takeoffItemName: takeoffById.get(m.takeoff_item_id)?.item_name || '',
      bidItemName: bidById.get(m.bid_line_item_id)?.item_name || '',
      matchType: m.match_type,
      confidence: m.match_confidence,
      reasoning: m.match_reasoning,
    })),
    unmatchedTakeoffItems: takeoffItems
      .filter(i => !matchedTakeoffIds.has(i.id))
      .map(i => ({ id: i.id, name: i.item_name, room: i.room || '' })),
    extraBidItems: bidLineItems
      .filter(i => !matchedBidIds.has(i.id))
      .map(i => ({ id: i.id, name: i.item_name, room: i.room })),
  }
}

/**
 * Match all bids for a given selection category against its takeoff.
 */
export async function matchAllBidsForCategory(
  projectId: string,
  selectionCategory: string,
  options?: { force?: boolean }
): Promise<BidMatchResult[]> {
  const mapping = getCategoryMapping(selectionCategory)
  if (!mapping) {
    console.warn(`No category mapping for selection category: ${selectionCategory}`)
    return []
  }

  // Get current takeoff run for this trade
  const { data: takeoffRuns } = await supabase
    .from('takeoff_runs')
    .select('id')
    .eq('project_id', projectId)
    .eq('trade', mapping.knowledgeTrade)
    .neq('status', 'superseded')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!takeoffRuns || takeoffRuns.length === 0) {
    console.warn(`No active takeoff run for trade: ${mapping.knowledgeTrade}`)
    return []
  }

  const takeoffRunId = takeoffRuns[0].id

  // Get all bids for the mapped bid category
  const { data: bids } = await supabase
    .from('bids')
    .select('id')
    .eq('project_id', projectId)
    .eq('category', mapping.bidCategory)

  if (!bids || bids.length === 0) {
    return []
  }

  // Match each bid
  const results: BidMatchResult[] = []
  for (const bid of bids) {
    const result = await matchBidToTakeoff(
      projectId,
      bid.id,
      takeoffRunId,
      options
    )
    results.push(result)
  }

  return results
}
