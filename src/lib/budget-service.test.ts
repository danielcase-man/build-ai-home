import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'eq', 'order', 'from'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

import { getBudgetItems } from './budget-service'

describe('getBudgetItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  it('returns budget items with parsed float costs', async () => {
    const items = [
      { id: '1', project_id: 'p1', category: 'Foundation', estimated_cost: '85000.50', actual_cost: '82000.00', status: 'paid' },
      { id: '2', project_id: 'p1', category: 'Framing', estimated_cost: null, actual_cost: null, status: 'pending' },
    ]
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: items, error: null }),
      writable: true, configurable: true,
    })

    const result = await getBudgetItems('p1')
    expect(result).toHaveLength(2)
    expect(result[0].estimated_cost).toBe(85000.50)
    expect(result[0].actual_cost).toBe(82000)
    expect(result[1].estimated_cost).toBeNull()
    expect(result[1].actual_cost).toBeNull()
  })

  it('returns empty array on error', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'fail' } }),
      writable: true, configurable: true,
    })

    const result = await getBudgetItems('p1')
    expect(result).toEqual([])
  })

  it('returns empty array when data is null', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getBudgetItems('p1')
    expect(result).toEqual([])
  })

  it('orders by payment_date descending', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      writable: true, configurable: true,
    })

    await getBudgetItems('p1')
    expect(mockChain.order).toHaveBeenCalledWith('payment_date', { ascending: false, nullsFirst: false })
  })
})
