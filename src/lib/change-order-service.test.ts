import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'insert', 'update', 'eq', 'order', 'limit', 'single', 'from'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

import { getChangeOrders, getChangeOrderSummary, createChangeOrder, updateChangeOrder } from './change-order-service'

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

describe('Change Order Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  describe('getChangeOrders', () => {
    it('fetches change orders ordered by number', async () => {
      const orders = [
        { id: 'co-1', change_order_number: 1, title: 'Add outlet', status: 'approved', cost_impact: 500 },
        { id: 'co-2', change_order_number: 2, title: 'Upgrade windows', status: 'draft', cost_impact: 5000 },
      ]
      mockSequentialResponses([{ data: orders }])

      const result = await getChangeOrders('proj-001')
      expect(result).toHaveLength(2)
    })
  })

  describe('getChangeOrderSummary', () => {
    it('calculates totals correctly', async () => {
      const orders = [
        { status: 'approved', cost_impact: 1000, schedule_impact_days: 2 },
        { status: 'approved', cost_impact: -500, schedule_impact_days: 0 },
        { status: 'draft', cost_impact: 3000, schedule_impact_days: 5 },
      ]
      mockSequentialResponses([{ data: orders }])

      const summary = await getChangeOrderSummary('proj-001')
      expect(summary.total).toBe(3)
      expect(summary.approved).toBe(2)
      expect(summary.pending).toBe(1)
      expect(summary.total_cost_impact).toBe(500) // 1000 + (-500) from approved only
    })
  })

  describe('createChangeOrder', () => {
    it('auto-increments CO number', async () => {
      mockChain.single
        .mockResolvedValueOnce({ data: { change_order_number: 3 }, error: null })
        .mockResolvedValueOnce({ data: { id: 'co-new', change_order_number: 4 }, error: null })

      const result = await createChangeOrder({
        project_id: 'proj-001',
        title: 'Test CO',
        description: '',
        category: null,
        requested_by: null,
        reason: 'owner_request',
        status: 'draft',
        cost_impact: 1000,
        schedule_impact_days: null,
        affected_milestone_id: null,
        affected_budget_items: null,
        contract_id: null,
        approved_date: null,
        notes: null,
      })

      expect(result?.change_order_number).toBe(4)
    })
  })

  describe('updateChangeOrder', () => {
    it('updates status', async () => {
      mockSequentialResponses([{ data: null }])
      const success = await updateChangeOrder('co-1', { status: 'approved' })
      expect(success).toBe(true)
    })
  })
})
