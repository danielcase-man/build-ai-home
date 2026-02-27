import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockChain, mockResult } = vi.hoisted(() => {
  const mockResult = { current: { data: null, error: null } as { data: unknown; error: unknown } }
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'insert', 'update', 'eq', 'ilike', 'order', 'limit', 'single']
  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => chain)
  }
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(mockResult.current))
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: (v: unknown) => void) => resolve(mockResult.current),
  })
  return { mockChain: chain, mockResult }
})

vi.mock('./supabase', () => ({
  supabase: mockChain,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('./project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
  getBudgetSummary: vi.fn(),
}))

import { executeAction } from './assistant-actions'
import type { PendingAction } from '@/types'

function makeAction(type: string, data: Record<string, unknown>): PendingAction {
  return {
    id: 'test-action',
    tool_use_id: 'call-1',
    type: type as PendingAction['type'],
    description: 'Test action',
    data,
  }
}

describe('executeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.current = { data: null, error: null }
  })

  it('returns error for unknown action type', async () => {
    const result = await executeAction(makeAction('unknown_type', {}))
    expect(result.success).toBe(false)
    expect(result.message).toContain('Unknown action type')
  })

  describe('update_bid', () => {
    it('updates a bid by ID', async () => {
      mockResult.current = { data: null, error: null }

      const result = await executeAction(makeAction('update_bid', {
        bid_id: 'bid-1',
        total_amount: 72000,
      }))

      expect(result.success).toBe(true)
      expect(result.message).toContain('bid-1')
      expect(mockChain.update).toHaveBeenCalled()
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'bid-1')
    })

    it('returns error when bid_id is missing', async () => {
      const result = await executeAction(makeAction('update_bid', {
        total_amount: 72000,
      }))

      expect(result.success).toBe(false)
      expect(result.message).toContain('Missing bid_id')
    })

    it('returns error on database failure', async () => {
      mockResult.current = { data: null, error: { message: 'not found' } }

      const result = await executeAction(makeAction('update_bid', {
        bid_id: 'bid-1',
        status: 'selected',
      }))

      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to update bid')
    })
  })

  describe('add_bid', () => {
    it('inserts a new bid', async () => {
      mockResult.current = { data: { id: 'new-bid-1' }, error: null }

      const result = await executeAction(makeAction('add_bid', {
        vendor_name: 'NewVendor',
        category: 'Roofing',
        description: 'Full roof',
        total_amount: 50000,
      }))

      expect(result.success).toBe(true)
      expect(result.message).toContain('NewVendor')
      expect(result.message).toContain('Roofing')
      expect(mockChain.insert).toHaveBeenCalled()
    })

    it('returns error on insert failure', async () => {
      mockResult.current = { data: null, error: { message: 'duplicate' } }

      const result = await executeAction(makeAction('add_bid', {
        vendor_name: 'Dup',
        category: 'Test',
        description: 'Test bid',
        total_amount: 100,
      }))

      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to add bid')
    })
  })

  describe('add_budget_item', () => {
    it('inserts a new budget item', async () => {
      mockResult.current = { data: { id: 'budget-1' }, error: null }

      const result = await executeAction(makeAction('add_budget_item', {
        category: 'Landscaping',
        description: 'Front yard',
        estimated_cost: 25000,
      }))

      expect(result.success).toBe(true)
      expect(result.message).toContain('Front yard')
    })
  })

  describe('update_milestone', () => {
    it('updates a milestone by ID', async () => {
      mockResult.current = { data: null, error: null }

      const result = await executeAction(makeAction('update_milestone', {
        milestone_id: 'ms-1',
        status: 'completed',
      }))

      expect(result.success).toBe(true)
      expect(result.message).toContain('ms-1')
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'ms-1')
    })

    it('returns error when milestone_id is missing', async () => {
      const result = await executeAction(makeAction('update_milestone', {
        status: 'completed',
      }))

      expect(result.success).toBe(false)
      expect(result.message).toContain('Missing milestone_id')
    })
  })
})
