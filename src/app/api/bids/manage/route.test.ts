import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockChain, mockResult } = vi.hoisted(() => {
  const mockResult = { current: { data: null as unknown, error: null as unknown } }
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'insert', 'update', 'eq', 'neq', 'in', 'order', 'single']
  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => chain)
  }
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(mockResult.current))
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: (v: unknown) => void) => resolve(mockResult.current),
  })
  return { mockChain: chain, mockResult }
})

vi.mock('@/lib/supabase', () => ({
  supabase: mockChain,
}))

const { mockGetAuthContext } = vi.hoisted(() => ({
  mockGetAuthContext: vi.fn(),
}))

vi.mock('@/lib/authorization', () => ({
  getAuthContext: mockGetAuthContext,
  getVendorScope: vi.fn().mockReturnValue(null),
}))

import { GET, PATCH, POST } from './route'

const fakeAuth = {
  user: { id: 'user-1', email: 'owner@test.com' },
  profile: { id: 'prof-1', role: 'owner', vendor_id: null },
  membership: { project_id: 'proj-1', role: 'owner', permissions: { all: true } },
}

describe('GET /api/bids/manage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.current = { data: null, error: null }
    mockGetAuthContext.mockResolvedValue(null) // GET allows null auth (vendor scoping only)
  })

  it('returns bids list', async () => {
    const bids = [
      { id: 'b-1', vendor_name: 'ACME', total_amount: 50000, status: 'pending' },
      { id: 'b-2', vendor_name: 'BuildCo', total_amount: 45000, status: 'selected' },
    ]
    mockResult.current = { data: bids, error: null }

    const req = new NextRequest('http://localhost/api/bids/manage')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.bids).toEqual(bids)
  })

  it('passes project_id filter', async () => {
    mockResult.current = { data: [], error: null }

    const req = new NextRequest('http://localhost/api/bids/manage?project_id=proj-1')
    await GET(req)
    expect(mockChain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
  })

  it('passes category filter', async () => {
    mockResult.current = { data: [], error: null }

    const req = new NextRequest('http://localhost/api/bids/manage?category=Roofing')
    await GET(req)
    expect(mockChain.eq).toHaveBeenCalledWith('category', 'Roofing')
  })

  it('returns error on DB failure', async () => {
    mockResult.current = { data: null, error: { message: 'DB error' } }

    const req = new NextRequest('http://localhost/api/bids/manage')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('PATCH /api/bids/manage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.current = { data: null, error: null }
    mockGetAuthContext.mockResolvedValue(fakeAuth)
  })

  it('returns validation error when missing bid_id', async () => {
    const req = new NextRequest('http://localhost/api/bids/manage', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'select' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('selects a bid and auto-rejects competitors', async () => {
    const selectedBid = {
      id: 'b-1',
      project_id: 'proj-1',
      category: 'Roofing',
      status: 'selected',
    }
    mockResult.current = { data: [selectedBid], error: null }

    const req = new NextRequest('http://localhost/api/bids/manage', {
      method: 'PATCH',
      body: JSON.stringify({ bid_id: 'b-1', action: 'select' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toContain('select')
    expect(json.data.bid).toEqual(selectedBid)
    // Should have auto-rejected competitors (calls update with rejected status)
    expect(mockChain.neq).toHaveBeenCalledWith('id', 'b-1')
  })

  it('rejects a bid', async () => {
    const rejected = { id: 'b-2', status: 'rejected' }
    mockResult.current = { data: [rejected], error: null }

    const req = new NextRequest('http://localhost/api/bids/manage', {
      method: 'PATCH',
      body: JSON.stringify({ bid_id: 'b-2', action: 'reject' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toContain('reject')
  })

  it('returns validation error for invalid action', async () => {
    const req = new NextRequest('http://localhost/api/bids/manage', {
      method: 'PATCH',
      body: JSON.stringify({ bid_id: 'b-1', action: 'invalid_action' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/bids/manage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.current = { data: null, error: null }
    mockGetAuthContext.mockResolvedValue(fakeAuth)
  })

  it('returns validation error when missing bid_id or action', async () => {
    const req = new NextRequest('http://localhost/api/bids/manage', {
      method: 'POST',
      body: JSON.stringify({ bid_id: 'b-1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns validation error when bid not found', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    const req = new NextRequest('http://localhost/api/bids/manage', {
      method: 'POST',
      body: JSON.stringify({ bid_id: 'b-999', action: 'finalize' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns validation error when bid is not selected', async () => {
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'b-1', status: 'pending', project_id: 'proj-1' },
      error: null,
    })

    const req = new NextRequest('http://localhost/api/bids/manage', {
      method: 'POST',
      body: JSON.stringify({ bid_id: 'b-1', action: 'finalize' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('Only selected bids')
  })

  it('finalizes a selected bid to budget', async () => {
    const bid = {
      id: 'b-1',
      status: 'selected',
      project_id: 'proj-1',
      category: 'Roofing',
      subcategory: 'Shingles',
      description: 'Roof install',
      vendor_name: 'ACME Roofing',
      total_amount: 25000,
      vendor_id: 'v-1',
      scope_of_work: 'Full roof',
      selection_notes: '',
      internal_notes: '',
    }
    const budgetItem = { id: 'bi-1', category: 'Roofing', estimated_cost: 25000, status: 'approved' }

    // First call: get bid via single()
    mockChain.single.mockResolvedValueOnce({ data: bid, error: null })
    // Second call: insert budget_item returns via thenable chain
    mockResult.current = { data: [budgetItem], error: null }

    const req = new NextRequest('http://localhost/api/bids/manage', {
      method: 'POST',
      body: JSON.stringify({ bid_id: 'b-1', action: 'finalize' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toContain('finalized')
    expect(json.data.budget_item).toEqual(budgetItem)
  })
})
