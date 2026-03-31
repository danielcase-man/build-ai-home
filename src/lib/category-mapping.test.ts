import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'knowledge-1' }, error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}))

import {
  getCategoryMapping,
  getSelectionCategoryForBidCategory,
  getBidCategoryForSelection,
  getPhaseForSelectionCategory,
  getAllCategoryMappings,
  resolveKnowledgeIdForSelection,
} from './category-mapping'

describe('getCategoryMapping', () => {
  it('returns mapping for known category', () => {
    const m = getCategoryMapping('plumbing')
    expect(m).toEqual({
      selectionCategory: 'plumbing',
      bidCategory: 'Plumbing Fixtures',
      knowledgeTrade: 'Plumbing Fixtures',
      phase: 7,
    })
  })

  it('returns null for unknown category', () => {
    expect(getCategoryMapping('unknown')).toBeNull()
  })

  it('handles all 20 categories', () => {
    const all = getAllCategoryMappings()
    expect(all).toHaveLength(20)
  })
})

describe('getSelectionCategoryForBidCategory', () => {
  it('maps bid category to selection category', () => {
    expect(getSelectionCategoryForBidCategory('Plumbing Fixtures')).toBe('plumbing')
    expect(getSelectionCategoryForBidCategory('Lighting Fixtures')).toBe('lighting')
    expect(getSelectionCategoryForBidCategory('Appliances')).toBe('appliance')
  })

  it('is case-insensitive', () => {
    expect(getSelectionCategoryForBidCategory('plumbing fixtures')).toBe('plumbing')
    expect(getSelectionCategoryForBidCategory('COUNTERTOPS')).toBe('countertop')
  })

  it('returns null for unknown bid category', () => {
    expect(getSelectionCategoryForBidCategory('Unknown Trade')).toBeNull()
  })
})

describe('getBidCategoryForSelection', () => {
  it('maps selection category to bid category', () => {
    expect(getBidCategoryForSelection('plumbing')).toBe('Plumbing Fixtures')
    expect(getBidCategoryForSelection('tile')).toBe('Tile')
    expect(getBidCategoryForSelection('windows')).toBe('Windows & Doors')
  })

  it('returns null for unknown selection category', () => {
    expect(getBidCategoryForSelection('unknown')).toBeNull()
  })
})

describe('getPhaseForSelectionCategory', () => {
  it('returns correct phase numbers', () => {
    expect(getPhaseForSelectionCategory('plumbing')).toBe(7)
    expect(getPhaseForSelectionCategory('lighting')).toBe(7)
    expect(getPhaseForSelectionCategory('tile')).toBe(6)
    expect(getPhaseForSelectionCategory('countertop')).toBe(6)
    expect(getPhaseForSelectionCategory('windows')).toBe(5)
  })

  it('returns null for unknown category', () => {
    expect(getPhaseForSelectionCategory('unknown')).toBeNull()
  })
})

describe('resolveKnowledgeIdForSelection', () => {
  it('returns knowledge_id for known category', async () => {
    const id = await resolveKnowledgeIdForSelection('plumbing')
    expect(id).toBe('knowledge-1')
  })

  it('returns null for unknown category', async () => {
    const id = await resolveKnowledgeIdForSelection('unknown')
    expect(id).toBeNull()
  })
})
