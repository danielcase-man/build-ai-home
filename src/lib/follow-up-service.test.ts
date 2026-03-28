import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'
import type { VendorFollowUp } from '@/types'

// ─── Mock Setup ────────────────────────────────────────────────────────────

let mockSb: ReturnType<typeof createMockSupabase>

vi.mock('./supabase', () => ({
  get supabase() {
    return mockSb.supabase
  },
}))

import {
  createFollowUp,
  createFollowUpsFromBidPackage,
  getFollowUps,
  getOverdueFollowUps,
  getUpcomingFollowUps,
  getDueToday,
  getFollowUpStats,
  markFollowUpSent,
  markFollowUpResponded,
  escalateFollowUp,
  completeFollowUp,
} from './follow-up-service'

// ─── Test Data ─────────────────────────────────────────────────────────────

const sampleFollowUp: VendorFollowUp = {
  id: 'fu-001',
  project_id: 'proj-001',
  vendor_name: 'Acme Lumber',
  contact_email: 'bids@acmelumber.com',
  category: 'bid_request',
  subject: 'Bid request sent to Acme Lumber',
  related_bid_package_id: 'pkg-001',
  created_date: '2026-03-20',
  initial_outreach_date: '2026-03-20',
  next_follow_up_date: '2026-04-03',
  deadline: '2026-04-03',
  status: 'sent',
  follow_up_count: 0,
  max_follow_ups: 3,
  auto_send: false,
  last_contact_date: '2026-03-20',
  last_contact_method: 'email',
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('follow-up-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createFollowUp', () => {
    it('inserts a follow-up and returns it', async () => {
      mockSb = createMockSupabase({ data: sampleFollowUp })
      const { id, created_at, updated_at, ...input } = sampleFollowUp
      const result = await createFollowUp(input)
      expect(result).toEqual(sampleFollowUp)
      expect(mockSb.chain.from).toHaveBeenCalledWith('vendor_follow_ups')
      expect(mockSb.chain.insert).toHaveBeenCalled()
    })

    it('returns null on error', async () => {
      mockSb = createMockSupabase({ error: { message: 'insert failed' } })
      const { id, created_at, updated_at, ...input } = sampleFollowUp
      const result = await createFollowUp(input)
      expect(result).toBeNull()
    })
  })

  describe('createFollowUpsFromBidPackage', () => {
    it('bulk-creates follow-ups for multiple vendors', async () => {
      const created = [sampleFollowUp, { ...sampleFollowUp, id: 'fu-002', vendor_name: 'Beta Framing' }]
      mockSb = createMockSupabase({ data: created })

      const result = await createFollowUpsFromBidPackage('proj-001', 'pkg-001', [
        { vendor_name: 'Acme Lumber', contact_email: 'bids@acmelumber.com', deadline: '2026-04-03' },
        { vendor_name: 'Beta Framing', contact_email: 'sales@betaframing.com' },
      ])

      expect(result).toHaveLength(2)
      expect(mockSb.chain.from).toHaveBeenCalledWith('vendor_follow_ups')
      expect(mockSb.chain.insert).toHaveBeenCalled()
    })

    it('returns empty array on error', async () => {
      mockSb = createMockSupabase({ error: { message: 'bulk insert failed' } })
      const result = await createFollowUpsFromBidPackage('proj-001', 'pkg-001', [
        { vendor_name: 'Test', contact_email: 'test@test.com' },
      ])
      expect(result).toEqual([])
    })
  })

  describe('getFollowUps', () => {
    it('returns follow-ups for a project', async () => {
      mockSb = createMockSupabase({ data: [sampleFollowUp] })
      const result = await getFollowUps('proj-001')
      expect(result).toEqual([sampleFollowUp])
      expect(mockSb.chain.eq).toHaveBeenCalledWith('project_id', 'proj-001')
    })

    it('filters by status', async () => {
      mockSb = createMockSupabase({ data: [sampleFollowUp] })
      await getFollowUps('proj-001', { status: 'sent' })
      expect(mockSb.chain.eq).toHaveBeenCalledWith('status', 'sent')
    })

    it('filters by category', async () => {
      mockSb = createMockSupabase({ data: [] })
      await getFollowUps('proj-001', { category: 'bid_request' })
      expect(mockSb.chain.eq).toHaveBeenCalledWith('category', 'bid_request')
    })

    it('filters by vendor name', async () => {
      mockSb = createMockSupabase({ data: [sampleFollowUp] })
      await getFollowUps('proj-001', { vendorName: 'Acme Lumber' })
      expect(mockSb.chain.eq).toHaveBeenCalledWith('vendor_name', 'Acme Lumber')
    })

    it('returns empty array on error', async () => {
      mockSb = createMockSupabase({ error: { message: 'query failed' } })
      const result = await getFollowUps('proj-001')
      expect(result).toEqual([])
    })
  })

  describe('getOverdueFollowUps', () => {
    it('queries with correct status filter and date', async () => {
      mockSb = createMockSupabase({ data: [sampleFollowUp] })
      // Need lte on the chain
      mockSb.chain.lte = vi.fn().mockReturnValue(mockSb.chain)

      const result = await getOverdueFollowUps('proj-001')
      expect(result).toEqual([sampleFollowUp])
      expect(mockSb.chain.in).toHaveBeenCalledWith('status', ['sent', 'awaiting_response', 'follow_up_sent'])
      expect(mockSb.chain.lte).toHaveBeenCalled()
    })
  })

  describe('getDueToday', () => {
    it('queries for today follow-ups', async () => {
      mockSb = createMockSupabase({ data: [sampleFollowUp] })
      const today = new Date().toISOString().slice(0, 10)

      const result = await getDueToday('proj-001')
      expect(result).toEqual([sampleFollowUp])
      expect(mockSb.chain.eq).toHaveBeenCalledWith('next_follow_up_date', today)
    })
  })

  describe('getFollowUpStats', () => {
    it('aggregates counts by status', async () => {
      mockSb = createMockSupabase({
        data: [
          { status: 'sent' },
          { status: 'sent' },
          { status: 'responded' },
          { status: 'escalated' },
          { status: 'completed' },
          { status: 'completed' },
          { status: 'completed' },
        ],
      })

      const stats = await getFollowUpStats('proj-001')
      expect(stats.sent).toBe(2)
      expect(stats.responded).toBe(1)
      expect(stats.escalated).toBe(1)
      expect(stats.completed).toBe(3)
      expect(stats.pending).toBe(0)
    })

    it('returns zeros on error', async () => {
      mockSb = createMockSupabase({ error: { message: 'fail' } })
      const stats = await getFollowUpStats('proj-001')
      expect(stats.pending).toBe(0)
      expect(stats.sent).toBe(0)
    })
  })

  describe('markFollowUpSent', () => {
    it('increments follow_up_count and updates status', async () => {
      mockSb = createMockSupabase({ data: { follow_up_count: 0, max_follow_ups: 3 } })

      // The update call resolves via thenable
      Object.defineProperty(mockSb.chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      const result = await markFollowUpSent('fu-001', 'email')
      expect(result).toBe(true)
      expect(mockSb.chain.update).toHaveBeenCalled()
    })

    it('returns false when follow-up not found', async () => {
      mockSb = createMockSupabase({ data: null, error: { message: 'not found' } })
      const result = await markFollowUpSent('fu-999', 'email')
      expect(result).toBe(false)
    })
  })

  describe('markFollowUpResponded', () => {
    it('sets status to responded with summary', async () => {
      mockSb = createMockSupabase({})
      Object.defineProperty(mockSb.chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      const result = await markFollowUpResponded('fu-001', 'Vendor sent updated bid at $82,000')
      expect(result).toBe(true)
      expect(mockSb.chain.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'responded',
        response_summary: 'Vendor sent updated bid at $82,000',
      }))
    })
  })

  describe('escalateFollowUp', () => {
    it('sets status to escalated with date', async () => {
      mockSb = createMockSupabase({})
      Object.defineProperty(mockSb.chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      const result = await escalateFollowUp('fu-001')
      expect(result).toBe(true)
      expect(mockSb.chain.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'escalated',
      }))
    })
  })

  describe('completeFollowUp', () => {
    it('sets status to completed', async () => {
      mockSb = createMockSupabase({})
      Object.defineProperty(mockSb.chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      const result = await completeFollowUp('fu-001')
      expect(result).toBe(true)
      expect(mockSb.chain.update).toHaveBeenCalledWith({ status: 'completed' })
    })
  })
})
