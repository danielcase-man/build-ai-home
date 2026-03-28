import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase, makeBid } from '@/test/helpers'
import type { DecisionLogEntry } from '@/types'

// ─── Mock Setup ────────────────────────────────────────────────────────────

let mockSb: ReturnType<typeof createMockSupabase>

vi.mock('./supabase', () => ({
  get supabase() {
    return mockSb.supabase
  },
}))

import {
  logDecision,
  logVendorSelection,
  getDecisions,
  getRecentDecisions,
  getDecisionsByVendor,
  updateOutcome,
} from './decision-log-service'

// ─── Test Data ─────────────────────────────────────────────────────────────

const sampleDecision: DecisionLogEntry = {
  id: 'dec-001',
  project_id: 'proj-001',
  decision_type: 'vendor_selection',
  category: 'Foundation',
  title: 'Selected Acme Construction for Foundation',
  description: 'Full foundation pour',
  chosen_option: 'Acme Construction',
  reasoning: 'Best price and timeline',
  cost_impact: 85000,
  decided_by: 'Daniel Case',
  decided_date: '2026-03-20',
  related_bid_id: 'bid-001',
  outcome_status: 'pending',
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('decision-log-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('logDecision', () => {
    it('inserts a decision and returns it', async () => {
      mockSb = createMockSupabase({ data: sampleDecision })
      const { id, created_at, updated_at, ...input } = sampleDecision
      const result = await logDecision(input)
      expect(result).toEqual(sampleDecision)
      expect(mockSb.chain.from).toHaveBeenCalledWith('decision_log')
      expect(mockSb.chain.insert).toHaveBeenCalled()
    })

    it('returns null on error', async () => {
      mockSb = createMockSupabase({ error: { message: 'insert failed' } })
      const { id, created_at, updated_at, ...input } = sampleDecision
      const result = await logDecision(input)
      expect(result).toBeNull()
    })
  })

  describe('logVendorSelection', () => {
    it('creates a vendor_selection decision from a bid', async () => {
      mockSb = createMockSupabase({ data: sampleDecision })
      const bid = makeBid({ id: 'bid-001', vendor_name: 'Acme Construction', category: 'Foundation', total_amount: 85000 })

      const result = await logVendorSelection('proj-001', bid, 'Best price and timeline')
      expect(result).toEqual(sampleDecision)
      expect(mockSb.chain.insert).toHaveBeenCalledWith(expect.objectContaining({
        project_id: 'proj-001',
        decision_type: 'vendor_selection',
        chosen_option: 'Acme Construction',
        related_bid_id: 'bid-001',
        cost_impact: 85000,
      }))
    })
  })

  describe('getDecisions', () => {
    it('returns decisions for a project', async () => {
      mockSb = createMockSupabase({ data: [sampleDecision] })
      const result = await getDecisions('proj-001')
      expect(result).toEqual([sampleDecision])
      expect(mockSb.chain.eq).toHaveBeenCalledWith('project_id', 'proj-001')
    })

    it('filters by decision type', async () => {
      mockSb = createMockSupabase({ data: [sampleDecision] })
      await getDecisions('proj-001', { type: 'vendor_selection' })
      expect(mockSb.chain.eq).toHaveBeenCalledWith('decision_type', 'vendor_selection')
    })

    it('filters by category', async () => {
      mockSb = createMockSupabase({ data: [] })
      await getDecisions('proj-001', { category: 'Foundation' })
      expect(mockSb.chain.eq).toHaveBeenCalledWith('category', 'Foundation')
    })

    it('returns empty array on error', async () => {
      mockSb = createMockSupabase({ error: { message: 'query failed' } })
      const result = await getDecisions('proj-001')
      expect(result).toEqual([])
    })
  })

  describe('getRecentDecisions', () => {
    it('queries with date filter', async () => {
      mockSb = createMockSupabase({ data: [sampleDecision] })
      const result = await getRecentDecisions('proj-001', 7)
      expect(result).toEqual([sampleDecision])
      expect(mockSb.chain.gte).toHaveBeenCalled()
    })

    it('returns empty array on error', async () => {
      mockSb = createMockSupabase({ error: { message: 'fail' } })
      const result = await getRecentDecisions('proj-001', 7)
      expect(result).toEqual([])
    })
  })

  describe('getDecisionsByVendor', () => {
    it('queries by vendor id', async () => {
      mockSb = createMockSupabase({ data: [sampleDecision] })
      const result = await getDecisionsByVendor('proj-001', 'vendor-001')
      expect(result).toEqual([sampleDecision])
      expect(mockSb.chain.eq).toHaveBeenCalledWith('related_vendor_id', 'vendor-001')
    })
  })

  describe('updateOutcome', () => {
    it('updates outcome status and notes', async () => {
      mockSb = createMockSupabase({})
      Object.defineProperty(mockSb.chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      const result = await updateOutcome('dec-001', { status: 'successful', notes: 'Completed on time and under budget' })
      expect(result).toBe(true)
      expect(mockSb.chain.update).toHaveBeenCalledWith(expect.objectContaining({
        outcome_status: 'successful',
        outcome_notes: 'Completed on time and under budget',
      }))
    })

    it('updates outcome with just status', async () => {
      mockSb = createMockSupabase({})
      Object.defineProperty(mockSb.chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      const result = await updateOutcome('dec-001', { status: 'problematic' })
      expect(result).toBe(true)
      expect(mockSb.chain.update).toHaveBeenCalledWith(expect.objectContaining({
        outcome_status: 'problematic',
      }))
    })
  })
})
