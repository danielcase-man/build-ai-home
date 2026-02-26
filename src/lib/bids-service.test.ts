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

import { getBids } from './bids-service'

describe('getBids', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  it('returns bids sorted by category then amount', async () => {
    const bids = [
      { id: '1', vendor_name: 'A', category: 'Foundation', total_amount: 80000 },
      { id: '2', vendor_name: 'B', category: 'Foundation', total_amount: 90000 },
    ]
    // The final .order() in the chain resolves
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: bids, error: null }),
      writable: true, configurable: true,
    })

    const result = await getBids('proj-1')
    expect(result).toEqual(bids)
    expect(mockChain.from).toHaveBeenCalledWith('bids')
    expect(mockChain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
    expect(mockChain.order).toHaveBeenCalledTimes(2)
  })

  it('returns empty array on error', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'fail' } }),
      writable: true, configurable: true,
    })

    const result = await getBids('proj-1')
    expect(result).toEqual([])
  })

  it('returns empty array when data is null without error', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getBids('proj-1')
    expect(result).toEqual([])
  })
})
