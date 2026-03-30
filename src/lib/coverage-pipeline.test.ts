import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CategoryCoverageSummary } from '@/types'

// ── Mock all pipeline dependencies ──────────────────────────────────────────

const mockGenerateFinishTakeoff = vi.fn()
vi.mock('./takeoff-generator-service', () => ({
  generateFinishTakeoff: (...args: unknown[]) => mockGenerateFinishTakeoff(...args),
}))

const mockNormalizeExistingLineItems = vi.fn()
vi.mock('./bid-reextraction-service', () => ({
  normalizeExistingLineItems: (...args: unknown[]) => mockNormalizeExistingLineItems(...args),
}))

const mockMatchAllBidsForCategory = vi.fn()
vi.mock('./coverage-matching-service', () => ({
  matchAllBidsForCategory: (...args: unknown[]) => mockMatchAllBidsForCategory(...args),
}))

const mockScoreCategoryBids = vi.fn()
vi.mock('./coverage-scoring-service', () => ({
  scoreCategoryBids: (...args: unknown[]) => mockScoreCategoryBids(...args),
}))

vi.mock('./category-mapping', () => ({
  getCategoryMapping: vi.fn((cat: string) => {
    const map: Record<string, { selectionCategory: string; bidCategory: string; knowledgeTrade: string; phase: number }> = {
      plumbing: { selectionCategory: 'plumbing', bidCategory: 'Plumbing Fixtures', knowledgeTrade: 'Plumbing Fixtures', phase: 7 },
      lighting: { selectionCategory: 'lighting', bidCategory: 'Lighting Fixtures', knowledgeTrade: 'Lighting Fixtures', phase: 7 },
      tile: { selectionCategory: 'tile', bidCategory: 'Tile', knowledgeTrade: 'Tile & Stone', phase: 6 },
    }
    return map[cat] || null
  }),
  getAllCategoryMappings: vi.fn().mockReturnValue([
    { selectionCategory: 'plumbing', bidCategory: 'Plumbing Fixtures', knowledgeTrade: 'Plumbing Fixtures', phase: 7 },
    { selectionCategory: 'lighting', bidCategory: 'Lighting Fixtures', knowledgeTrade: 'Lighting Fixtures', phase: 7 },
    { selectionCategory: 'tile', bidCategory: 'Tile', knowledgeTrade: 'Tile & Stone', phase: 6 },
  ]),
}))

// Mock dynamic supabase import used in the pipeline for counting takeoff items
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [{ id: 'ti-1' }, { id: 'ti-2' }], error: null }),
      }),
    }),
  },
}))

// ── Import AFTER mocks ────────────────────────────────────────────────────────
import { runCoveragePipeline } from './coverage-pipeline'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSummary(category: string): CategoryCoverageSummary {
  return {
    category,
    selectionCategory: category.toLowerCase(),
    trade: `${category} Trade`,
    phase: 7,
    takeoffItemCount: 5,
    takeoffTotalCost: 2500,
    bidCount: 2,
    bestCoverageBid: { vendorName: 'Best Co', coveragePct: 80, bidTotal: 2000 },
    gapCount: 1,
    gapItems: [{ name: 'Gap Item', room: 'Kitchen', estimatedCost: 500 }],
    scores: [],
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('coverage-pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockGenerateFinishTakeoff.mockResolvedValue({ id: 'run-001', trade: 'Plumbing Fixtures' })
    mockNormalizeExistingLineItems.mockResolvedValue({ normalized: 2, skipped: 0, errors: [] })
    mockMatchAllBidsForCategory.mockResolvedValue([
      {
        bidId: 'bid-001',
        vendorName: 'Vendor A',
        takeoffRunId: 'run-001',
        category: 'Plumbing Fixtures',
        totalTakeoffItems: 5,
        matchedCount: 3,
        unmatchedTakeoffCount: 2,
        extraBidItemCount: 1,
        matches: [
          { takeoffItemId: 'ti-1', bidLineItemId: 'bi-1', takeoffItemName: 'Faucet', bidItemName: 'Faucet', matchType: 'exact_model', confidence: 1.0 },
          { takeoffItemId: 'ti-2', bidLineItemId: 'bi-2', takeoffItemName: 'Sink', bidItemName: 'Sink', matchType: 'name_match', confidence: 0.9 },
          { takeoffItemId: 'ti-3', bidLineItemId: 'bi-3', takeoffItemName: 'Tub', bidItemName: 'Bathtub', matchType: 'ai_inferred', confidence: 0.7 },
        ],
        unmatchedTakeoffItems: [],
        extraBidItems: [{ id: 'bi-4', name: 'Installation Kit', room: undefined }],
      },
    ])
    mockScoreCategoryBids.mockResolvedValue(makeSummary('Plumbing Fixtures'))
  })

  it('single category pipeline runs all 4 phases in order', async () => {
    const results = await runCoveragePipeline('proj-001', 'plumbing')

    expect(results).toHaveLength(1)
    const r = results[0]

    // Phase 1: takeoff generation was called
    expect(mockGenerateFinishTakeoff).toHaveBeenCalledWith('proj-001', 'plumbing')

    // Phase 2: normalization was called
    expect(mockNormalizeExistingLineItems).toHaveBeenCalledWith('proj-001')

    // Phase 3: matching was called
    expect(mockMatchAllBidsForCategory).toHaveBeenCalledWith(
      'proj-001', 'plumbing', { force: undefined }
    )

    // Phase 4: scoring was called
    expect(mockScoreCategoryBids).toHaveBeenCalledWith('proj-001', 'plumbing')

    expect(r.category).toBe('Plumbing Fixtures')
    expect(r.takeoffItems).toBe(2) // from mocked supabase count
    expect(r.matchesCreated).toBe(3)
    expect(r.coverageSummary).not.toBeNull()
    expect(r.errors).toHaveLength(0)
    expect(r.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('all-categories pipeline processes each mapping', async () => {
    // Set up different summaries per category
    mockScoreCategoryBids
      .mockResolvedValueOnce(makeSummary('Plumbing Fixtures'))
      .mockResolvedValueOnce(makeSummary('Lighting Fixtures'))
      .mockResolvedValueOnce(makeSummary('Tile'))

    const results = await runCoveragePipeline('proj-001')

    expect(results).toHaveLength(3)
    expect(results[0].category).toBe('Plumbing Fixtures')
    expect(results[1].category).toBe('Lighting Fixtures')
    expect(results[2].category).toBe('Tile')

    // generateFinishTakeoff called for each category
    expect(mockGenerateFinishTakeoff).toHaveBeenCalledTimes(3)

    // normalization only called ONCE (not per category)
    expect(mockNormalizeExistingLineItems).toHaveBeenCalledTimes(1)

    // matching and scoring called for each
    expect(mockMatchAllBidsForCategory).toHaveBeenCalledTimes(3)
    expect(mockScoreCategoryBids).toHaveBeenCalledTimes(3)
  })

  it('errors in one category do not block others', async () => {
    // Takeoff generation fails for plumbing
    mockGenerateFinishTakeoff
      .mockRejectedValueOnce(new Error('Takeoff generation failed for plumbing'))
      .mockResolvedValueOnce({ id: 'run-002', trade: 'Lighting Fixtures' })
      .mockResolvedValueOnce({ id: 'run-003', trade: 'Tile & Stone' })

    // Scoring also fails for lighting
    mockScoreCategoryBids
      .mockResolvedValueOnce(makeSummary('Plumbing Fixtures')) // plumbing scoring still runs
      .mockRejectedValueOnce(new Error('Scoring blew up'))
      .mockResolvedValueOnce(makeSummary('Tile'))

    const results = await runCoveragePipeline('proj-001')

    expect(results).toHaveLength(3)

    // Plumbing had a takeoff error but matching/scoring still ran
    expect(results[0].errors.length).toBeGreaterThan(0)
    expect(results[0].errors[0]).toContain('Takeoff generation')
    // Scoring should still have run
    expect(results[0].coverageSummary).not.toBeNull()

    // Lighting had a scoring error
    expect(results[1].errors.length).toBeGreaterThan(0)
    expect(results[1].errors.some(e => e.includes('Scoring'))).toBe(true)
    expect(results[1].coverageSummary).toBeNull()

    // Tile was clean
    expect(results[2].errors).toHaveLength(0)
    expect(results[2].coverageSummary).not.toBeNull()
  })

  it('passes force option to matching step', async () => {
    await runCoveragePipeline('proj-001', 'plumbing', { force: true })

    expect(mockMatchAllBidsForCategory).toHaveBeenCalledWith(
      'proj-001', 'plumbing', { force: true }
    )
  })

  it('returns error for unknown category', async () => {
    const results = await runCoveragePipeline('proj-001', 'unknown_category')

    expect(results).toHaveLength(1)
    expect(results[0].errors[0]).toContain('No category mapping found')
    expect(results[0].takeoffItems).toBe(0)
    expect(results[0].coverageSummary).toBeNull()
  })
})
