import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetBids, mockGetBudgetItems, mockGetSelections, mockGetRecentEmails, mockSupabaseChain, mockSupabaseResult } = vi.hoisted(() => {
  const mockSupabaseResult = { current: { data: [] as unknown[], error: null } }
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'eq', 'order', 'limit']
  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => chain)
  }
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: (v: unknown) => void) => resolve(mockSupabaseResult.current),
  })
  return {
    mockGetBids: vi.fn(),
    mockGetBudgetItems: vi.fn(),
    mockGetSelections: vi.fn(),
    mockGetRecentEmails: vi.fn(),
    mockSupabaseChain: chain,
    mockSupabaseResult,
  }
})

vi.mock('@/lib/bids-service', () => ({
  getBids: mockGetBids,
}))

vi.mock('@/lib/budget-service', () => ({
  getBudgetItems: mockGetBudgetItems,
}))

vi.mock('@/lib/selections-service', () => ({
  getSelections: mockGetSelections,
}))

vi.mock('@/lib/database', () => ({
  db: { getRecentEmails: mockGetRecentEmails },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseChain,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET } from './route'

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetBids.mockResolvedValue([])
    mockGetBudgetItems.mockResolvedValue([])
    mockGetSelections.mockResolvedValue([])
    mockGetRecentEmails.mockResolvedValue([])
    mockSupabaseResult.current = { data: [], error: null }
  })

  it('returns empty results when query is missing', async () => {
    const req = new NextRequest('http://localhost/api/search')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.results).toEqual([])
  })

  it('returns empty results when query is too short (<2 chars)', async () => {
    const req = new NextRequest('http://localhost/api/search?q=a')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.results).toEqual([])
  })

  it('returns matching bid results', async () => {
    mockGetBids.mockResolvedValueOnce([
      {
        id: 'bid-1',
        vendor_name: 'Delta Plumbing',
        category: 'plumbing',
        description: 'Rough-in plumbing',
        subcategory: null,
        total_amount: 25000,
        status: 'accepted',
      },
      {
        id: 'bid-2',
        vendor_name: 'Sparks Electric',
        category: 'electrical',
        description: 'Wiring',
        subcategory: null,
        total_amount: 18000,
        status: 'pending',
      },
    ])

    const req = new NextRequest('http://localhost/api/search?q=plumbing')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.results.length).toBe(1)
    expect(json.data.results[0].type).toBe('bid')
    expect(json.data.results[0].id).toBe('bid-1')
  })

  it('returns matching budget results', async () => {
    mockGetBudgetItems.mockResolvedValueOnce([
      {
        id: 'b-1',
        category: 'Framing',
        description: 'Framing labor',
        subcategory: null,
        estimated_cost: 45000,
        actual_cost: null,
      },
    ])

    const req = new NextRequest('http://localhost/api/search?q=framing')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.results.length).toBe(1)
    expect(json.data.results[0].type).toBe('budget')
  })

  it('returns matching selection results', async () => {
    mockGetSelections.mockResolvedValueOnce([
      {
        id: 'sel-1',
        product_name: 'Delta Faucet',
        brand: 'Delta',
        category: 'plumbing',
        room: 'Kitchen',
        model_number: 'DF-100',
        status: 'selected',
      },
    ])

    const req = new NextRequest('http://localhost/api/search?q=delta')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.results.length).toBe(1)
    expect(json.data.results[0].type).toBe('selection')
  })

  it('returns matching email results', async () => {
    mockGetRecentEmails.mockResolvedValueOnce([
      {
        id: 'e-1',
        message_id: 'msg-1',
        subject: 'Bid from Delta Plumbing',
        sender_email: 'vendor@delta.com',
        sender_name: 'Delta Vendor',
        ai_summary: 'Plumbing bid summary',
        received_date: '2026-03-20T10:00:00Z',
      },
    ])

    const req = new NextRequest('http://localhost/api/search?q=delta')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.results.length).toBe(1)
    expect(json.data.results[0].type).toBe('email')
  })

  it('returns results across multiple types', async () => {
    mockGetBids.mockResolvedValueOnce([
      {
        id: 'bid-1',
        vendor_name: 'Delta Plumbing',
        category: 'plumbing',
        description: 'Rough-in',
        subcategory: null,
        total_amount: 25000,
        status: 'accepted',
      },
    ])
    mockGetSelections.mockResolvedValueOnce([
      {
        id: 'sel-1',
        product_name: 'Delta Faucet',
        brand: 'Delta',
        category: 'plumbing',
        room: 'Kitchen',
        model_number: null,
        status: 'selected',
      },
    ])

    const req = new NextRequest('http://localhost/api/search?q=delta')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.results.length).toBe(2)
    const types = json.data.results.map((r: { type: string }) => r.type)
    expect(types).toContain('bid')
    expect(types).toContain('selection')
  })
})
