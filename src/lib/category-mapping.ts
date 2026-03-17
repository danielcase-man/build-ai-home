/**
 * Category Mapping — bidirectional mapping between selection categories,
 * bid categories, knowledge graph trades, and construction phases.
 */

import { supabase } from './supabase'

export interface CategoryMapping {
  selectionCategory: string
  bidCategory: string
  knowledgeTrade: string
  phase: number
}

const CATEGORY_MAP: CategoryMapping[] = [
  { selectionCategory: 'plumbing', bidCategory: 'Plumbing Fixtures', knowledgeTrade: 'Plumbing Fixtures', phase: 7 },
  { selectionCategory: 'lighting', bidCategory: 'Lighting Fixtures', knowledgeTrade: 'Lighting Fixtures', phase: 7 },
  { selectionCategory: 'appliance', bidCategory: 'Appliances', knowledgeTrade: 'Appliances', phase: 7 },
  { selectionCategory: 'tile', bidCategory: 'Tile', knowledgeTrade: 'Tile & Stone', phase: 6 },
  { selectionCategory: 'paint', bidCategory: 'Painting', knowledgeTrade: 'Painting', phase: 6 },
  { selectionCategory: 'hardware', bidCategory: 'Doors & Trim', knowledgeTrade: 'Interior Doors & Trim', phase: 6 },
  { selectionCategory: 'countertop', bidCategory: 'Countertops', knowledgeTrade: 'Countertops', phase: 6 },
  { selectionCategory: 'flooring', bidCategory: 'Flooring', knowledgeTrade: 'Flooring', phase: 6 },
  { selectionCategory: 'cabinetry', bidCategory: 'Cabinetry', knowledgeTrade: 'Cabinetry', phase: 6 },
  { selectionCategory: 'windows', bidCategory: 'Windows & Doors', knowledgeTrade: 'Windows & Doors', phase: 5 },
]

/** Get the full mapping for a selection category */
export function getCategoryMapping(selectionCategory: string): CategoryMapping | null {
  return CATEGORY_MAP.find(m => m.selectionCategory === selectionCategory) || null
}

/** Map a bid category to a selection category */
export function getSelectionCategoryForBidCategory(bidCategory: string): string | null {
  const mapping = CATEGORY_MAP.find(m => m.bidCategory.toLowerCase() === bidCategory.toLowerCase())
  return mapping?.selectionCategory ?? null
}

/** Map a selection category to a bid category */
export function getBidCategoryForSelection(selectionCategory: string): string | null {
  return getCategoryMapping(selectionCategory)?.bidCategory ?? null
}

/** Get the construction phase number for a selection category */
export function getPhaseForSelectionCategory(selectionCategory: string): number | null {
  return getCategoryMapping(selectionCategory)?.phase ?? null
}

/** Get all mappings */
export function getAllCategoryMappings(): CategoryMapping[] {
  return [...CATEGORY_MAP]
}

// Cache for knowledge_id lookups: trade name → knowledge item id
const knowledgeIdCache = new Map<string, string | null>()

/**
 * Resolve the knowledge graph decision point UUID for a selection category.
 * Looks up construction_knowledge for a decision_point matching the trade.
 * Results are cached in-memory.
 */
export async function resolveKnowledgeIdForSelection(selectionCategory: string): Promise<string | null> {
  const mapping = getCategoryMapping(selectionCategory)
  if (!mapping) return null

  const cacheKey = mapping.knowledgeTrade
  if (knowledgeIdCache.has(cacheKey)) {
    return knowledgeIdCache.get(cacheKey)!
  }

  const { data } = await supabase
    .from('construction_knowledge')
    .select('id')
    .eq('trade', mapping.knowledgeTrade)
    .eq('item_type', 'decision_point')
    .limit(1)
    .single()

  const knowledgeId = data?.id ?? null
  knowledgeIdCache.set(cacheKey, knowledgeId)
  return knowledgeId
}
