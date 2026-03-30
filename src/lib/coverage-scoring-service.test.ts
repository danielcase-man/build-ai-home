import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'
import type { TakeoffItem, BidLineItem, CoverageMatch } from '@/types'

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

// ── Category mapping mock ─────────────────────────────────────────────────────
vi.mock('./category-mapping', () => ({
  getCategoryMapping: vi.fn().mockReturnValue({
    selectionCategory: 'plumbing',
    bidCategory: 'Plumbing Fixtures',
    knowledgeTrade: 'Plumbing Fixtures',
    phase: 7,
  }),
  getAllCategoryMappings: vi.fn().mockReturnValue([
    { selectionCategory: 'plumbing', bidCategory: 'Plumbing Fixtures', knowledgeTrade: 'Plumbing Fixtures', phase: 7 },
    { selectionCategory: 'lighting', bidCategory: 'Lighting Fixtures', knowledgeTrade: 'Lighting Fixtures', phase: 7 },
  ]),
}))

// ── Import AFTER mocks ────────────────────────────────────────────────────────
import {
  scoreBidCoverage,
  scoreCategoryBids,
  getProjectCoverageSummary,
} from './coverage-scoring-service'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeTakeoffItem(overrides: Partial<TakeoffItem> = {}): TakeoffItem {
  return {
    id: 'ti-001',
    takeoff_run_id: 'run-001',
    project_id: 'proj-001',
    category: 'plumbing',
    trade: 'Plumbing Fixtures',
    item_name: 'Kitchen Faucet',
    quantity: 1,
    unit: 'each',
    source: 'calculated',
    confidence: 'verified',
    total_cost: 500,
    room: 'Kitchen',
    ...overrides,
  }
}

function makeBidLineItem(overrides: Partial<BidLineItem> = {}): BidLineItem {
  return {
    id: 'bi-001',
    bid_id: 'bid-001',
    item_name: 'Kitchen Faucet',
    quantity: 1,
    total_price: 450,
    sort_order: 1,
    ...overrides,
  }
}

function makeCoverageMatch(overrides: Partial<CoverageMatch> = {}): CoverageMatch {
  return {
    id: 'cm-001',
    project_id: 'proj-001',
    takeoff_item_id: 'ti-001',
    bid_line_item_id: 'bi-001',
    match_type: 'exact_model',
    match_confidence: 1.0,
    status: 'proposed',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('coverage-scoring-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetup.result.data = null
    mockSetup.result.error = null
  })

  // ── scoreBidCoverage ──────────────────────────────────────────────────────

  describe('scoreBidCoverage', () => {
    it('returns correct percentages (3/5 matched = 60%)', async () => {
      const takeoffItems: TakeoffItem[] = [
        makeTakeoffItem({ id: 'ti-1', item_name: 'Faucet A', room: 'Kitchen', total_cost: 300 }),
        makeTakeoffItem({ id: 'ti-2', item_name: 'Faucet B', room: 'Bath 1', total_cost: 400 }),
        makeTakeoffItem({ id: 'ti-3', item_name: 'Faucet C', room: 'Bath 2', total_cost: 350 }),
        makeTakeoffItem({ id: 'ti-4', item_name: 'Shower Head', room: 'Primary Bath', total_cost: 200 }),
        makeTakeoffItem({ id: 'ti-5', item_name: 'Tub Filler', room: 'Primary Bath', total_cost: 600 }),
      ]
      const bidLineItems: BidLineItem[] = [
        makeBidLineItem({ id: 'bi-1', item_name: 'Faucet A', total_price: 280 }),
        makeBidLineItem({ id: 'bi-2', item_name: 'Faucet B', total_price: 410 }),
        makeBidLineItem({ id: 'bi-3', item_name: 'Faucet C', total_price: 330 }),
        makeBidLineItem({ id: 'bi-4', item_name: 'Installation Kit', total_price: 100 }),
      ]
      const matches: CoverageMatch[] = [
        makeCoverageMatch({ id: 'cm-1', takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-1', match_confidence: 0.95 }),
        makeCoverageMatch({ id: 'cm-2', takeoff_item_id: 'ti-2', bid_line_item_id: 'bi-2', match_confidence: 0.90 }),
        makeCoverageMatch({ id: 'cm-3', takeoff_item_id: 'ti-3', bid_line_item_id: 'bi-3', match_confidence: 0.85 }),
      ]

      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          // Call 1: coverage_matches
          if (callCount === 1) return resolve({ data: matches, error: null })
          // Call 2: takeoff_items
          if (callCount === 2) return resolve({ data: takeoffItems, error: null })
          // Call 3: bid_line_items
          if (callCount === 3) return resolve({ data: bidLineItems, error: null })
          // Call 5: isLatestBidVersion query
          if (callCount === 5) return resolve({ data: [{ id: 'bid-001' }], error: null })
          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      // Call 4: bids.single()
      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Acme Plumbing', category: 'Plumbing Fixtures', total_amount: 1120, bid_date: '2026-03-01' },
        error: null,
      })

      const result = await scoreBidCoverage('proj-001', 'bid-001', 'run-001')

      expect(result.coveragePct).toBe(60)
      expect(result.matchedItems).toBe(3)
      expect(result.missingItems).toBe(2)
      expect(result.extraItems).toBe(1) // bi-4 is unmatched
      expect(result.matchDetails).toHaveLength(3)
      expect(result.missingItemDetails).toHaveLength(2)
    })

    it('computes price variance correctly', async () => {
      const takeoffItems: TakeoffItem[] = [
        makeTakeoffItem({ id: 'ti-1', total_cost: 500 }),
        makeTakeoffItem({ id: 'ti-2', total_cost: 300, item_name: 'B' }),
      ]
      const bidLineItems: BidLineItem[] = [
        makeBidLineItem({ id: 'bi-1', total_price: 600 }),
      ]
      const matches: CoverageMatch[] = [
        makeCoverageMatch({ takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-1' }),
      ]

      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          if (callCount === 1) return resolve({ data: matches, error: null })
          if (callCount === 2) return resolve({ data: takeoffItems, error: null })
          if (callCount === 3) return resolve({ data: bidLineItems, error: null })
          if (callCount === 5) return resolve({ data: [{ id: 'bid-001' }], error: null })
          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Acme', category: 'Plumbing Fixtures', total_amount: 1200, bid_date: '2026-03-01' },
        error: null,
      })

      const result = await scoreBidCoverage('proj-001', 'bid-001', 'run-001')

      // takeoffTotal = 500 + 300 = 800, bidTotal = 1200
      expect(result.takeoffTotal).toBe(800)
      expect(result.priceVariance).toBe(400)
      expect(result.bidTotal).toBe(1200)
    })

    it('identifies latest version among multiple vendor bids', async () => {
      const takeoffItems = [makeTakeoffItem({ id: 'ti-1' })]
      const bidLineItems = [makeBidLineItem({ id: 'bi-1' })]
      const matches = [
        makeCoverageMatch({ takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-1' }),
      ]

      // Promise.all resolves 3 chains via .then, 1 via .single()
      // Then isLatestBidVersion is another .then call
      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          // Calls 1-3: the 3 non-single queries in Promise.all
          if (callCount === 1) return resolve({ data: matches, error: null })
          if (callCount === 2) return resolve({ data: takeoffItems, error: null })
          if (callCount === 3) return resolve({ data: bidLineItems, error: null })
          // Call 4: isLatestBidVersion — return a DIFFERENT bid as newest
          if (callCount === 4) return resolve({ data: [{ id: 'bid-newer' }], error: null })
          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      // The 4th query in Promise.all uses .single()
      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Acme', category: 'Plumbing', total_amount: 1000, bid_date: '2026-01-01' },
        error: null,
      })

      const result = await scoreBidCoverage('proj-001', 'bid-001', 'run-001')

      // bid-001 is NOT the latest (bid-newer is)
      expect(result.latestVersion).toBe(false)
    })

    it('populates missing item details for unmatched takeoff items', async () => {
      const takeoffItems = [
        makeTakeoffItem({ id: 'ti-1', item_name: 'Faucet', room: 'Kitchen', total_cost: 500 }),
        makeTakeoffItem({ id: 'ti-2', item_name: 'Shower Head', room: 'Primary Bath', total_cost: 300 }),
      ]
      const bidLineItems = [makeBidLineItem({ id: 'bi-1', total_price: 480 })]
      const matches = [
        makeCoverageMatch({ takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-1' }),
      ]

      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          if (callCount === 1) return resolve({ data: matches, error: null })
          if (callCount === 2) return resolve({ data: takeoffItems, error: null })
          if (callCount === 3) return resolve({ data: bidLineItems, error: null })
          if (callCount === 5) return resolve({ data: [{ id: 'bid-001' }], error: null })
          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Acme', category: 'Plumbing', total_amount: 480, bid_date: '2026-03-01' },
        error: null,
      })

      const result = await scoreBidCoverage('proj-001', 'bid-001', 'run-001')

      expect(result.missingItemDetails).toHaveLength(1)
      expect(result.missingItemDetails[0]).toEqual({
        takeoffItemName: 'Shower Head',
        takeoffRoom: 'Primary Bath',
        estimatedCost: 300,
      })
    })
  })

  // ── scoreCategoryBids ──────────────────────────────────────────────────────

  describe('scoreCategoryBids', () => {
    it('finds universal gaps (items no bid covers)', async () => {
      // Setup: 3 takeoff items, 2 bids, one item not covered by either
      const takeoffItems = [
        makeTakeoffItem({ id: 'ti-1', item_name: 'Faucet A', room: 'Kitchen', total_cost: 300 }),
        makeTakeoffItem({ id: 'ti-2', item_name: 'Faucet B', room: 'Bath', total_cost: 400 }),
        makeTakeoffItem({ id: 'ti-3', item_name: 'Tub Filler', room: 'Primary', total_cost: 600 }),
      ]

      // Bid 1 matches ti-1 and ti-2
      const bid1Matches = [
        makeCoverageMatch({ takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-1a', match_confidence: 0.9 }),
        makeCoverageMatch({ takeoff_item_id: 'ti-2', bid_line_item_id: 'bi-1b', match_confidence: 0.85 }),
      ]
      const bid1Lines = [
        makeBidLineItem({ id: 'bi-1a', bid_id: 'bid-a', item_name: 'Faucet A', total_price: 280 }),
        makeBidLineItem({ id: 'bi-1b', bid_id: 'bid-a', item_name: 'Faucet B', total_price: 390 }),
      ]

      // Bid 2 matches ti-1 only
      const bid2Matches = [
        makeCoverageMatch({ takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-2a', match_confidence: 0.95 }),
      ]
      const bid2Lines = [
        makeBidLineItem({ id: 'bi-2a', bid_id: 'bid-b', item_name: 'Faucet A', total_price: 310 }),
      ]

      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          // 1: takeoff_runs
          if (callCount === 1) return resolve({ data: [{ id: 'run-001' }], error: null })
          // 2: takeoff_items (for category summary)
          if (callCount === 2) return resolve({ data: takeoffItems, error: null })
          // 3: bids list
          if (callCount === 3) return resolve({ data: [{ id: 'bid-a' }, { id: 'bid-b' }], error: null })

          // --- scoreBidCoverage for bid-a ---
          // 4: coverage_matches
          if (callCount === 4) return resolve({ data: bid1Matches, error: null })
          // 5: takeoff_items
          if (callCount === 5) return resolve({ data: takeoffItems, error: null })
          // 6: bid_line_items
          if (callCount === 6) return resolve({ data: bid1Lines, error: null })
          // 8: isLatestBidVersion
          if (callCount === 8) return resolve({ data: [{ id: 'bid-a' }], error: null })

          // --- scoreBidCoverage for bid-b ---
          // 9: coverage_matches
          if (callCount === 9) return resolve({ data: bid2Matches, error: null })
          // 10: takeoff_items
          if (callCount === 10) return resolve({ data: takeoffItems, error: null })
          // 11: bid_line_items
          if (callCount === 11) return resolve({ data: bid2Lines, error: null })
          // 13: isLatestBidVersion
          if (callCount === 13) return resolve({ data: [{ id: 'bid-b' }], error: null })

          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      // bids.single() for bid-a (call 7) and bid-b (call 12)
      chain.single
        .mockResolvedValueOnce({
          data: { vendor_name: 'Vendor A', category: 'Plumbing Fixtures', total_amount: 670, bid_date: '2026-03-01' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { vendor_name: 'Vendor B', category: 'Plumbing Fixtures', total_amount: 310, bid_date: '2026-03-05' },
          error: null,
        })

      const result = await scoreCategoryBids('proj-001', 'plumbing')

      expect(result).not.toBeNull()
      expect(result!.scores).toHaveLength(2)
      // ti-3 (Tub Filler) is not matched by any bid
      expect(result!.gapCount).toBe(1)
      expect(result!.gapItems[0].name).toBe('Tub Filler')
    })

    it('identifies best coverage bid', async () => {
      const takeoffItems = [
        makeTakeoffItem({ id: 'ti-1', item_name: 'Faucet', room: 'Kitchen', total_cost: 300 }),
      ]
      const matches = [
        makeCoverageMatch({ takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-1' }),
      ]
      const bidLines = [
        makeBidLineItem({ id: 'bi-1', bid_id: 'bid-a', total_price: 290 }),
      ]

      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          if (callCount === 1) return resolve({ data: [{ id: 'run-001' }], error: null })
          if (callCount === 2) return resolve({ data: takeoffItems, error: null })
          if (callCount === 3) return resolve({ data: [{ id: 'bid-a' }], error: null })
          if (callCount === 4) return resolve({ data: matches, error: null })
          if (callCount === 5) return resolve({ data: takeoffItems, error: null })
          if (callCount === 6) return resolve({ data: bidLines, error: null })
          if (callCount === 8) return resolve({ data: [{ id: 'bid-a' }], error: null })
          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Best Vendor', category: 'Plumbing Fixtures', total_amount: 290, bid_date: '2026-03-01' },
        error: null,
      })

      const result = await scoreCategoryBids('proj-001', 'plumbing')

      expect(result!.bestCoverageBid).toEqual({
        vendorName: 'Best Vendor',
        coveragePct: 100,
        bidTotal: 290,
      })
    })
  })

  // ── getProjectCoverageSummary ─────────────────────────────────────────────

  describe('getProjectCoverageSummary', () => {
    it('returns all categories with takeoffs', async () => {
      // For plumbing: has a takeoff run and bid
      // For lighting: no takeoff run
      const takeoffItems = [makeTakeoffItem({ id: 'ti-1', total_cost: 500 })]
      const matches = [makeCoverageMatch({ takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-1' })]
      const bidLines = [makeBidLineItem({ id: 'bi-1', total_price: 480 })]

      // With Promise.all in scoreBidCoverage, the .then call count is:
      // plumbing: takeoff_runs(1), takeoff_items(2), bids(3),
      //   scoreBid Promise.all: matches(4), takeoff(5), bidLines(6), [single for bid],
      //   isLatest(7)
      // lighting: takeoff_runs(8) → empty → null
      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          // ─ plumbing category: scoreCategoryBids ─
          if (callCount === 1) return resolve({ data: [{ id: 'run-001' }], error: null }) // takeoff_runs
          if (callCount === 2) return resolve({ data: takeoffItems, error: null }) // takeoff_items
          if (callCount === 3) return resolve({ data: [{ id: 'bid-a' }], error: null }) // bids

          // ─ scoreBidCoverage Promise.all (3 non-single + 1 single) ─
          if (callCount === 4) return resolve({ data: matches, error: null }) // coverage_matches
          if (callCount === 5) return resolve({ data: takeoffItems, error: null }) // takeoff_items
          if (callCount === 6) return resolve({ data: bidLines, error: null }) // bid_line_items
          // callCount 7 would be isLatestBidVersion
          if (callCount === 7) return resolve({ data: [{ id: 'bid-a' }], error: null }) // isLatest

          // ─ lighting category ─
          if (callCount === 8) return resolve({ data: [], error: null }) // no takeoff runs → null

          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      // .single() for bids query inside scoreBidCoverage Promise.all
      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Plumb Co', category: 'Plumbing Fixtures', total_amount: 480, bid_date: '2026-03-01' },
        error: null,
      })

      const summaries = await getProjectCoverageSummary('proj-001')

      // Only plumbing should appear (lighting has no takeoff run)
      expect(summaries).toHaveLength(1)
      expect(summaries[0].selectionCategory).toBe('plumbing')
      expect(summaries[0].scores).toHaveLength(1)
    })
  })
})
