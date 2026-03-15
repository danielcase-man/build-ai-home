import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ──────────────────────────────────────────────────────────
const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'gte', 'or', 'order', 'limit', 'single', 'from', 'is'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

import {
  getVendorThreads,
  getThreadTimeline,
  getFollowUpsNeeded,
  createVendorThread,
  updateVendorThread,
  markBidReceived,
} from './vendor-thread-service'

function mockSequentialResponses(responses: Array<{ data?: unknown; error?: unknown }>) {
  let callCount = 0
  Object.defineProperty(mockChain, 'then', {
    value: (resolve: (v: unknown) => void) => {
      const resp = responses[callCount] || responses[responses.length - 1]
      callCount++
      resolve({ data: resp.data ?? null, error: resp.error ?? null })
    },
    writable: true,
    configurable: true,
  })
}

function makeThread(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vt-001',
    project_id: 'proj-001',
    vendor_id: null,
    contact_id: 'ct-001',
    vendor_name: 'Acme Foundation',
    vendor_email: 'acme@example.com',
    category: 'Foundation',
    status: 'active',
    last_activity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    follow_up_date: null,
    bid_requested_date: null,
    bid_received_date: null,
    contract_id: null,
    notes: null,
    ...overrides,
  }
}

describe('Vendor Thread Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  describe('getVendorThreads', () => {
    it('returns threads with calculated days_since_contact', async () => {
      const thread = makeThread()
      mockSequentialResponses([{ data: [thread] }])

      const result = await getVendorThreads('proj-001')
      expect(result).toHaveLength(1)
      expect(result[0].vendor_name).toBe('Acme Foundation')
      expect(result[0].days_since_contact).toBe(3)
    })

    it('filters by status', async () => {
      mockSequentialResponses([{ data: [] }])

      await getVendorThreads('proj-001', { status: 'waiting_response' })
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'waiting_response')
    })

    it('returns empty on error', async () => {
      mockSequentialResponses([{ data: null, error: { message: 'DB error' } }])

      const result = await getVendorThreads('proj-001')
      expect(result).toEqual([])
    })
  })

  describe('getFollowUpsNeeded', () => {
    it('flags threads waiting too long for response', async () => {
      const thread = makeThread({
        status: 'waiting_response',
        last_activity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      mockSequentialResponses([{ data: [thread] }])

      const result = await getFollowUpsNeeded('proj-001', 5)
      expect(result).toHaveLength(1)
      expect(result[0].reason).toContain('Waiting')
      expect(result[0].days_waiting).toBe(7)
    })

    it('flags overdue bid requests', async () => {
      const thread = makeThread({
        status: 'active',
        bid_requested_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        bid_received_date: null,
      })
      mockSequentialResponses([{ data: [thread] }])

      const result = await getFollowUpsNeeded('proj-001', 5)
      expect(result).toHaveLength(1)
      expect(result[0].reason).toContain('Bid requested')
    })

    it('ignores closed threads', async () => {
      const thread = makeThread({ status: 'closed' })
      mockSequentialResponses([{ data: [thread] }])

      const result = await getFollowUpsNeeded('proj-001', 5)
      expect(result).toHaveLength(0)
    })

    it('flags past follow-up dates', async () => {
      const thread = makeThread({
        follow_up_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })
      mockSequentialResponses([{ data: [thread] }])

      const result = await getFollowUpsNeeded('proj-001', 5)
      expect(result).toHaveLength(1)
      expect(result[0].reason).toContain('Follow-up date passed')
    })

    it('sorts by most overdue first', async () => {
      const threads = [
        makeThread({ id: 'vt-1', vendor_name: 'A', status: 'waiting_response', last_activity: new Date(Date.now() - 5 * 86400000).toISOString() }),
        makeThread({ id: 'vt-2', vendor_name: 'B', status: 'waiting_response', last_activity: new Date(Date.now() - 10 * 86400000).toISOString() }),
      ]
      mockSequentialResponses([{ data: threads }])

      const result = await getFollowUpsNeeded('proj-001', 5)
      expect(result[0].thread.vendor_name).toBe('B') // 10 days > 5 days
    })
  })

  describe('createVendorThread', () => {
    it('creates a new thread', async () => {
      const created = makeThread()
      mockChain.single.mockResolvedValueOnce({ data: created, error: null })

      const result = await createVendorThread({
        project_id: 'proj-001',
        vendor_id: null,
        contact_id: 'ct-001',
        vendor_name: 'Acme Foundation',
        vendor_email: 'acme@example.com',
        category: 'Foundation',
        status: 'active',
        last_activity: new Date().toISOString(),
        follow_up_date: null,
        bid_requested_date: null,
        bid_received_date: null,
        contract_id: null,
        notes: null,
      })

      expect(result).toBeDefined()
      expect(result?.vendor_name).toBe('Acme Foundation')
      expect(mockChain.insert).toHaveBeenCalled()
    })
  })

  describe('updateVendorThread', () => {
    it('updates thread status', async () => {
      mockSequentialResponses([{ data: null }])

      const success = await updateVendorThread('vt-001', { status: 'closed' })
      expect(success).toBe(true)
      expect(mockChain.update).toHaveBeenCalled()
    })
  })

  describe('markBidReceived', () => {
    it('sets bid_received_date and status', async () => {
      mockSequentialResponses([{ data: null }])

      const success = await markBidReceived('vt-001', '2026-03-15')
      expect(success).toBe(true)
    })
  })
})
