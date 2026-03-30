import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase, createMockAnthropicClient } from '@/test/helpers'
import type { TakeoffItem, BidLineItem } from '@/types'

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

// ── AI mock ───────────────────────────────────────────────────────────────────
const mockAI = createMockAnthropicClient(JSON.stringify([
  { takeoff_id: 'ti-3', bid_id: 'bi-3', confidence: 0.75, reasoning: 'Both are towel bars for primary bath' },
]))

vi.mock('./ai-clients', () => ({
  getAnthropicClient: () => mockAI,
  parseAIJsonResponse: (text: string) => JSON.parse(text),
}))

// ── Category mapping mock ─────────────────────────────────────────────────────
vi.mock('./category-mapping', () => ({
  getCategoryMapping: vi.fn().mockReturnValue({
    selectionCategory: 'plumbing',
    bidCategory: 'Plumbing Fixtures',
    knowledgeTrade: 'Plumbing Fixtures',
    phase: 7,
  }),
}))

// ── Import AFTER mocks ────────────────────────────────────────────────────────
import {
  tier1DeterministicMatch,
  tier2FuzzyMatch,
  tier3AIMatch,
  matchBidToTakeoff,
} from './coverage-matching-service'

// ── Factories ─────────────────────────────────────────────────────────────────

function makeTakeoffItem(overrides: Partial<TakeoffItem> = {}): TakeoffItem {
  return {
    id: 'ti-001',
    takeoff_run_id: 'run-001',
    project_id: 'proj-001',
    category: 'plumbing',
    trade: 'Plumbing Fixtures',
    item_name: 'Pull-Down Kitchen Faucet',
    quantity: 1,
    unit: 'each',
    source: 'calculated',
    confidence: 'verified',
    ...overrides,
  }
}

function makeBidLineItem(overrides: Partial<BidLineItem> = {}): BidLineItem {
  return {
    id: 'bi-001',
    bid_id: 'bid-001',
    item_name: 'Pull-Down Kitchen Faucet',
    quantity: 1,
    total_price: 450,
    sort_order: 1,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('coverage-matching-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the thenable so await chain resolves to default result
    mockSetup.result.data = null
    mockSetup.result.error = null
  })

  // ── Tier 1 Tests ────────────────────────────────────────────────────────────

  describe('tier1DeterministicMatch', () => {
    it('matches on exact model number from material_spec', () => {
      const takeoff = [makeTakeoffItem({
        id: 'ti-1',
        item_name: 'Kitchen Faucet',
        material_spec: 'Newport Brass 2470-5103/04',
      })]
      const bid = [makeBidLineItem({
        id: 'bi-1',
        item_name: 'Faucet Set',
        model_number: '2470-5103/04',
      })]

      const matches = tier1DeterministicMatch(takeoff, bid)

      expect(matches.size).toBe(1)
      const match = matches.get('ti-1')!
      expect(match.bidItemId).toBe('bi-1')
      expect(match.type).toBe('exact_model')
      expect(match.confidence).toBe(1.0)
    })

    it('matches on exact name + room', () => {
      const takeoff = [makeTakeoffItem({
        id: 'ti-1',
        item_name: 'Pull-Down Kitchen Faucet',
        room: 'Kitchen',
      })]
      const bid = [makeBidLineItem({
        id: 'bi-1',
        item_name: 'Pull-Down Kitchen Faucet',
        room: 'Kitchen',
      })]

      const matches = tier1DeterministicMatch(takeoff, bid)

      expect(matches.size).toBe(1)
      const match = matches.get('ti-1')!
      expect(match.bidItemId).toBe('bi-1')
      expect(match.type).toBe('name_match')
      expect(match.confidence).toBe(0.95)
    })

    it('matches name when bid room is null (universal)', () => {
      const takeoff = [makeTakeoffItem({
        id: 'ti-1',
        item_name: 'Pull-Down Kitchen Faucet',
        room: 'Kitchen',
      })]
      const bid = [makeBidLineItem({
        id: 'bi-1',
        item_name: 'Pull-Down Kitchen Faucet',
        room: undefined,
      })]

      const matches = tier1DeterministicMatch(takeoff, bid)

      expect(matches.size).toBe(1)
      expect(matches.get('ti-1')!.confidence).toBe(0.95)
    })

    it('matches name when bid room is "Whole House"', () => {
      const takeoff = [makeTakeoffItem({
        id: 'ti-1',
        item_name: 'Recessed Light',
        room: 'Primary Bedroom',
      })]
      const bid = [makeBidLineItem({
        id: 'bi-1',
        item_name: 'Recessed Light',
        room: 'Whole House',
      })]

      const matches = tier1DeterministicMatch(takeoff, bid)

      expect(matches.size).toBe(1)
      expect(matches.get('ti-1')!.confidence).toBe(0.95)
    })

    it('matches on brand + category + room', () => {
      const takeoff = [makeTakeoffItem({
        id: 'ti-1',
        item_name: 'Vessel Sink',
        material_spec: 'Kohler K-2660',
        category: 'plumbing',
        room: 'Primary Bathroom',
      })]
      const bid = [makeBidLineItem({
        id: 'bi-1',
        item_name: 'Bathroom Sink Basin',
        brand: 'Kohler',
        category: 'plumbing',
        room: 'Primary Bathroom',
      })]

      const matches = tier1DeterministicMatch(takeoff, bid)

      expect(matches.size).toBe(1)
      const match = matches.get('ti-1')!
      expect(match.type).toBe('name_match')
      expect(match.confidence).toBe(0.90)
    })

    it('prevents double-matching: each bid item matches at most one takeoff item', () => {
      const takeoff = [
        makeTakeoffItem({ id: 'ti-1', item_name: 'Kitchen Faucet', room: 'Kitchen' }),
        makeTakeoffItem({ id: 'ti-2', item_name: 'Kitchen Faucet', room: 'Prep Kitchen' }),
      ]
      const bid = [
        makeBidLineItem({ id: 'bi-1', item_name: 'Kitchen Faucet', room: 'Kitchen' }),
      ]

      const matches = tier1DeterministicMatch(takeoff, bid)

      // Only one takeoff should match since there's only one bid item
      expect(matches.size).toBe(1)
      expect(matches.get('ti-1')!.bidItemId).toBe('bi-1')
      expect(matches.has('ti-2')).toBe(false)
    })

    it('returns empty map when no matches found', () => {
      const takeoff = [makeTakeoffItem({ id: 'ti-1', item_name: 'Toilet' })]
      const bid = [makeBidLineItem({ id: 'bi-1', item_name: 'Shower Head' })]

      const matches = tier1DeterministicMatch(takeoff, bid)

      expect(matches.size).toBe(0)
    })

    it('handles empty arrays', () => {
      expect(tier1DeterministicMatch([], []).size).toBe(0)
      expect(tier1DeterministicMatch([makeTakeoffItem()], []).size).toBe(0)
      expect(tier1DeterministicMatch([], [makeBidLineItem()]).size).toBe(0)
    })

    it('model match takes priority over name match', () => {
      const takeoff = [makeTakeoffItem({
        id: 'ti-1',
        item_name: 'Kitchen Faucet',
        material_spec: 'Delta 9178-AR-DST',
      })]
      const bid = [
        makeBidLineItem({ id: 'bi-1', item_name: 'Kitchen Faucet', room: 'Kitchen' }),
        makeBidLineItem({ id: 'bi-2', item_name: 'Faucet Assembly', model_number: '9178-AR-DST' }),
      ]

      const matches = tier1DeterministicMatch(takeoff, bid)

      expect(matches.size).toBe(1)
      // Model match (pass 1) should be chosen over name match (pass 2)
      expect(matches.get('ti-1')!.bidItemId).toBe('bi-2')
      expect(matches.get('ti-1')!.type).toBe('exact_model')
    })
  })

  // ── Tier 2 Tests ────────────────────────────────────────────────────────────

  describe('tier2FuzzyMatch', () => {
    it('matches fuzzy names with compatible rooms', () => {
      const takeoff = [makeTakeoffItem({
        id: 'ti-1',
        item_name: 'Pull-Down Kitchen Faucet',
        room: 'Kitchen',
      })]
      const bid = [makeBidLineItem({
        id: 'bi-1',
        item_name: 'Kitchen Faucet w/ spray',
        room: 'Kitchen',
      })]

      const matches = tier2FuzzyMatch(takeoff, bid)

      expect(matches.size).toBe(1)
      const match = matches.get('ti-1')!
      expect(match.bidItemId).toBe('bi-1')
      expect(match.type).toBe('room_inferred')
      expect(match.confidence).toBeGreaterThan(0.4)
      expect(match.confidence).toBeLessThanOrEqual(0.9)
    })

    it('does not match when rooms differ and names are dissimilar', () => {
      const takeoff = [makeTakeoffItem({
        id: 'ti-1',
        item_name: 'Bath 2 Faucet',
        room: 'Bathroom 2',
      })]
      const bid = [makeBidLineItem({
        id: 'bi-1',
        item_name: 'Kitchen Faucet',
        room: 'Kitchen',
      })]

      const matches = tier2FuzzyMatch(takeoff, bid)

      // The Jaccard of {"bath", "2", "faucet"} vs {"kitchen", "faucet"} = 1/4 = 0.25, below 0.5
      // AND rooms don't match, so no match expected
      expect(matches.size).toBe(0)
    })

    it('matches on category + quantity + partial name overlap', () => {
      const takeoff = [makeTakeoffItem({
        id: 'ti-1',
        item_name: 'Widespread Bathroom Faucet',
        category: 'plumbing',
        quantity: 2,
        room: 'Primary Bathroom',
      })]
      const bid = [makeBidLineItem({
        id: 'bi-1',
        item_name: 'Bathroom Widespread Faucet Set',
        category: 'plumbing',
        quantity: 2,
        room: 'Primary Bathroom',
      })]

      const matches = tier2FuzzyMatch(takeoff, bid)

      expect(matches.size).toBe(1)
      expect(matches.get('ti-1')!.bidItemId).toBe('bi-1')
    })

    it('prevents double-matching with greedy best-first', () => {
      const takeoff = [
        makeTakeoffItem({ id: 'ti-1', item_name: 'Sink Faucet', room: 'Kitchen' }),
        makeTakeoffItem({ id: 'ti-2', item_name: 'Sink Sprayer', room: 'Kitchen' }),
      ]
      const bid = [
        makeBidLineItem({ id: 'bi-1', item_name: 'Kitchen Sink Faucet Sprayer', room: 'Kitchen' }),
      ]

      const matches = tier2FuzzyMatch(takeoff, bid)

      // Only one takeoff can match the single bid item
      expect(matches.size).toBe(1)
    })

    it('handles empty arrays', () => {
      expect(tier2FuzzyMatch([], []).size).toBe(0)
      expect(tier2FuzzyMatch([makeTakeoffItem()], []).size).toBe(0)
      expect(tier2FuzzyMatch([], [makeBidLineItem()]).size).toBe(0)
    })
  })

  // ── Tier 3 Tests ────────────────────────────────────────────────────────────

  describe('tier3AIMatch', () => {
    it('calls AI and returns parsed matches', async () => {
      const takeoff = [makeTakeoffItem({ id: 'ti-3', item_name: 'Towel Bar' })]
      const bid = [makeBidLineItem({ id: 'bi-3', item_name: 'Towel Rack 24"' })]

      const matches = await tier3AIMatch(takeoff, bid, 'Plumbing Fixtures')

      expect(matches.size).toBe(1)
      const match = matches.get('ti-3')!
      expect(match.bidItemId).toBe('bi-3')
      expect(match.type).toBe('ai_inferred')
      expect(match.confidence).toBe(0.75)
      expect(match.reasoning).toContain('towel bars')
    })

    it('returns empty map when takeoff array is empty', async () => {
      const matches = await tier3AIMatch([], [makeBidLineItem()], 'Plumbing')
      expect(matches.size).toBe(0)
      // AI should not be called
      expect(mockAI.messages.create).not.toHaveBeenCalled()
    })

    it('returns empty map when bid array is empty', async () => {
      const matches = await tier3AIMatch([makeTakeoffItem()], [], 'Plumbing')
      expect(matches.size).toBe(0)
      expect(mockAI.messages.create).not.toHaveBeenCalled()
    })

    it('filters out matches with invalid IDs', async () => {
      // Mock returns a match with ti-3 and bi-3, but we pass different IDs
      const takeoff = [makeTakeoffItem({ id: 'ti-99', item_name: 'Towel Bar' })]
      const bid = [makeBidLineItem({ id: 'bi-99', item_name: 'Towel Rack' })]

      const matches = await tier3AIMatch(takeoff, bid, 'Plumbing')

      // AI returned ti-3/bi-3 which don't exist in our arrays
      expect(matches.size).toBe(0)
    })

    it('prevents AI double-matching', async () => {
      // Mock AI returning duplicates
      mockAI.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify([
          { takeoff_id: 'ti-a', bid_id: 'bi-x', confidence: 0.8, reasoning: 'Match 1' },
          { takeoff_id: 'ti-b', bid_id: 'bi-x', confidence: 0.7, reasoning: 'Match 2 (dup bid)' },
        ]) }],
      })

      const takeoff = [
        makeTakeoffItem({ id: 'ti-a', item_name: 'Item A' }),
        makeTakeoffItem({ id: 'ti-b', item_name: 'Item B' }),
      ]
      const bid = [makeBidLineItem({ id: 'bi-x', item_name: 'Bid Item X' })]

      const matches = await tier3AIMatch(takeoff, bid, 'Test')

      // Second match should be rejected (bi-x already used)
      expect(matches.size).toBe(1)
      expect(matches.get('ti-a')!.bidItemId).toBe('bi-x')
      expect(matches.has('ti-b')).toBe(false)
    })
  })

  // ── Integration Tests ───────────────────────────────────────────────────────

  describe('matchBidToTakeoff', () => {
    it('returns correct BidMatchResult structure with matches', async () => {
      const takeoffItems = [
        makeTakeoffItem({ id: 'ti-1', item_name: 'Kitchen Faucet', material_spec: 'Delta 9178-AR-DST', room: 'Kitchen' }),
        makeTakeoffItem({ id: 'ti-2', item_name: 'Bathroom Faucet', room: 'Primary Bath' }),
      ]
      const bidLineItems = [
        makeBidLineItem({ id: 'bi-1', item_name: 'Faucet Assembly', model_number: '9178-AR-DST' }),
        makeBidLineItem({ id: 'bi-2', item_name: 'Bath Faucet', room: 'Primary Bath' }),
        makeBidLineItem({ id: 'bi-3', item_name: 'Installation Kit' }),
      ]

      // Setup mock sequence: takeoff_items, bid_line_items, bids, coverage_matches check, upsert
      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          // Call 1: takeoff_items
          if (callCount === 1) return resolve({ data: takeoffItems, error: null })
          // Call 2: bid_line_items
          if (callCount === 2) return resolve({ data: bidLineItems, error: null })
          // Call 4: existing coverage_matches check — empty (no prior matches)
          if (callCount === 4) return resolve({ data: [], error: null })
          // Call 5+: upsert result
          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      // Call 3: bids.single()
      let singleCallCount = 0
      chain.single.mockImplementation(() => {
        singleCallCount++
        if (singleCallCount === 1) {
          return Promise.resolve({ data: { vendor_name: 'Acme Plumbing', category: 'Plumbing Fixtures' }, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const result = await matchBidToTakeoff('proj-001', 'bid-001', 'run-001')

      expect(result.bidId).toBe('bid-001')
      expect(result.vendorName).toBe('Acme Plumbing')
      expect(result.category).toBe('Plumbing Fixtures')
      expect(result.totalTakeoffItems).toBe(2)
      // At least the model number match should have been found
      expect(result.matchedCount).toBeGreaterThanOrEqual(1)
      expect(result.matches.length).toBeGreaterThanOrEqual(1)

      // Verify model match
      const modelMatch = result.matches.find(m => m.takeoffItemId === 'ti-1')
      expect(modelMatch).toBeDefined()
      expect(modelMatch!.matchType).toBe('exact_model')
      expect(modelMatch!.confidence).toBe(1.0)

      // Verify structural invariant
      expect(result.matchedCount + result.unmatchedTakeoffCount).toBe(result.totalTakeoffItems)
    })

    it('skips matching when coverage_matches already exist', async () => {
      const takeoffItems = [makeTakeoffItem({ id: 'ti-1' })]
      const bidLineItems = [makeBidLineItem({ id: 'bi-1' })]

      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          if (callCount === 1) return resolve({ data: takeoffItems, error: null })
          if (callCount === 2) return resolve({ data: bidLineItems, error: null })
          // existing coverage_matches — non-empty (matches already exist)
          if (callCount === 4) return resolve({
            data: [{ id: 'cm-1', takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-1', match_type: 'exact_model', match_confidence: 1.0, match_reasoning: 'cached', project_id: 'proj-001' }],
            error: null,
          })
          // buildResultFromExisting fetches full matches
          if (callCount === 5) return resolve({
            data: [{ id: 'cm-1', takeoff_item_id: 'ti-1', bid_line_item_id: 'bi-1', match_type: 'exact_model', match_confidence: 1.0, match_reasoning: 'cached', project_id: 'proj-001' }],
            error: null,
          })
          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Cached Vendor', category: 'Plumbing' }, error: null,
      })

      const result = await matchBidToTakeoff('proj-001', 'bid-001', 'run-001')

      expect(result.vendorName).toBe('Cached Vendor')
      expect(result.matchedCount).toBe(1)
      // AI should NOT have been called
      expect(mockAI.messages.create).not.toHaveBeenCalled()
    })

    it('re-matches when force=true even if matches exist', async () => {
      const takeoffItems = [
        makeTakeoffItem({ id: 'ti-1', item_name: 'Kitchen Faucet', material_spec: 'Delta 9178-AR-DST' }),
      ]
      const bidLineItems = [
        makeBidLineItem({ id: 'bi-1', item_name: 'Faucet', model_number: '9178-AR-DST' }),
      ]

      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          if (callCount === 1) return resolve({ data: takeoffItems, error: null })
          if (callCount === 2) return resolve({ data: bidLineItems, error: null })
          // All subsequent calls (delete + upsert) return success
          return resolve({ data: null, error: null })
        },
        writable: true,
        configurable: true,
      })

      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Force Vendor', category: 'Plumbing' }, error: null,
      })

      const result = await matchBidToTakeoff('proj-001', 'bid-001', 'run-001', { force: true })

      // Should have run matching (model number match)
      expect(result.matchedCount).toBe(1)
      expect(result.matches[0].matchType).toBe('exact_model')

      // Verify upsert was called (persisted results)
      expect(chain.upsert).toHaveBeenCalled()
    })

    it('handles empty takeoff gracefully', async () => {
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
        writable: true,
        configurable: true,
      })
      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Empty', category: 'Plumbing' }, error: null,
      })

      const result = await matchBidToTakeoff('proj-001', 'bid-001', 'run-001', { force: true })

      expect(result.totalTakeoffItems).toBe(0)
      expect(result.matchedCount).toBe(0)
      expect(result.matches).toHaveLength(0)
    })

    it('handles empty bid line items gracefully', async () => {
      let callCount = 0
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => {
          callCount++
          if (callCount === 1) return resolve({ data: [makeTakeoffItem({ id: 'ti-1' })], error: null })
          return resolve({ data: [], error: null })
        },
        writable: true,
        configurable: true,
      })
      chain.single.mockResolvedValueOnce({
        data: { vendor_name: 'Empty Bid', category: 'Plumbing' }, error: null,
      })

      const result = await matchBidToTakeoff('proj-001', 'bid-001', 'run-001', { force: true })

      expect(result.totalTakeoffItems).toBe(1)
      expect(result.matchedCount).toBe(0)
      expect(result.unmatchedTakeoffCount).toBe(1)
      expect(result.extraBidItemCount).toBe(0)
    })
  })
})
