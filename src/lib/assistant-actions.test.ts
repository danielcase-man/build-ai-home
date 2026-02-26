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
    type: type as PendingAction['type'],
    label: 'Test',
    description: 'Test action',
    data,
    status: 'pending',
    toolCallId: 'call-1',
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
    it('updates a matching bid', async () => {
      // First call: select query returns one match
      mockResult.current = { data: [{ id: 'bid-1', vendor_name: 'Prestige Steel', category: 'Windows', total_amount: 68000 }], error: null }

      const result = await executeAction(makeAction('update_bid', {
        vendor_name: 'Prestige',
        total_amount: 72000,
      }))

      expect(result.success).toBe(true)
      expect(result.message).toContain('Prestige Steel')
    })

    it('returns error when no bid matches', async () => {
      mockResult.current = { data: [], error: null }

      const result = await executeAction(makeAction('update_bid', {
        vendor_name: 'NonExistent',
      }))

      expect(result.success).toBe(false)
      expect(result.message).toContain('No bid found')
    })

    it('returns error when multiple bids match', async () => {
      mockResult.current = {
        data: [
          { id: 'bid-1', vendor_name: 'Prestige Steel', category: 'Windows' },
          { id: 'bid-2', vendor_name: 'Prestige Iron', category: 'Doors' },
        ],
        error: null,
      }

      const result = await executeAction(makeAction('update_bid', {
        vendor_name: 'Prestige',
      }))

      expect(result.success).toBe(false)
      expect(result.message).toContain('Multiple bids')
    })
  })

  describe('add_bid', () => {
    it('inserts a new bid', async () => {
      mockResult.current = { data: { id: 'new-bid-1' }, error: null }

      const result = await executeAction(makeAction('add_bid', {
        vendor_name: 'NewVendor',
        category: 'Roofing',
        total_amount: 50000,
      }))

      expect(result.success).toBe(true)
      expect(result.message).toContain('NewVendor')
      expect(result.message).toContain('$50,000')
    })

    it('returns error on insert failure', async () => {
      mockResult.current = { data: null, error: { message: 'duplicate' } }

      const result = await executeAction(makeAction('add_bid', {
        vendor_name: 'Dup',
        category: 'Test',
        total_amount: 100,
      }))

      expect(result.success).toBe(false)
      expect(result.message).toContain('Database error')
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

  describe('add_contact', () => {
    it('inserts a new contact', async () => {
      mockResult.current = { data: { id: 'contact-1' }, error: null }

      const result = await executeAction(makeAction('add_contact', {
        name: 'John Doe',
        role: 'Electrician',
        email: 'john@test.com',
      }))

      expect(result.success).toBe(true)
      expect(result.message).toContain('John Doe')
      expect(result.message).toContain('Electrician')
    })
  })
})
