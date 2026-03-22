import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockChain, mockResult, mockCompareBids } = vi.hoisted(() => {
  const mockResult = { current: { data: null as unknown, error: null as unknown } }
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'insert', 'in', 'eq', 'order']
  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => chain)
  }
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: (v: unknown) => void) => resolve(mockResult.current),
  })
  return { mockChain: chain, mockResult, mockCompareBids: vi.fn() }
})

vi.mock('@/lib/supabase', () => ({
  supabase: mockChain,
}))

vi.mock('@/lib/bid-extractor', () => ({
  compareBids: mockCompareBids,
}))

import { POST } from './route'

describe('POST /api/bids/compare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.current = { data: null, error: null }
  })

  it('returns validation error when fewer than 2 bid_ids', async () => {
    const req = new NextRequest('http://localhost/api/bids/compare', {
      method: 'POST',
      body: JSON.stringify({ bid_ids: ['b-1'] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns validation error when bid_ids is missing', async () => {
    const req = new NextRequest('http://localhost/api/bids/compare', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns validation error when not enough bids found', async () => {
    // Only 1 bid returned from DB (need 2+)
    mockResult.current = {
      data: [{ id: 'b-1', vendor_name: 'ACME', total_amount: '50000' }],
      error: null,
    }

    const req = new NextRequest('http://localhost/api/bids/compare', {
      method: 'POST',
      body: JSON.stringify({ bid_ids: ['b-1', 'b-2'] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('enough bids')
  })

  it('compares bids successfully', async () => {
    const bids = [
      {
        id: 'b-1', vendor_name: 'ACME', vendor_contact: 'John', vendor_email: 'j@acme.com',
        vendor_phone: '555-1111', category: 'Roofing', subcategory: 'Shingles',
        description: 'Full roof', total_amount: '50000', line_items: [],
        scope_of_work: 'Complete', inclusions: 'All', exclusions: 'None',
        payment_terms: 'Net 30', warranty_terms: '10 yr', estimated_duration: '2 weeks',
        lead_time_weeks: 4, valid_until: '2026-06-01', ai_confidence: '0.9',
        ai_extraction_notes: '', project_id: 'proj-1',
      },
      {
        id: 'b-2', vendor_name: 'BuildCo', vendor_contact: 'Jane', vendor_email: 'j@buildco.com',
        vendor_phone: '555-2222', category: 'Roofing', subcategory: 'Shingles',
        description: 'Full roof', total_amount: '45000', line_items: [],
        scope_of_work: 'Complete', inclusions: 'All', exclusions: 'None',
        payment_terms: 'Net 15', warranty_terms: '5 yr', estimated_duration: '3 weeks',
        lead_time_weeks: 6, valid_until: '2026-06-01', ai_confidence: '0.85',
        ai_extraction_notes: '', project_id: 'proj-1',
      },
    ]
    // DB returns bids
    mockResult.current = { data: bids, error: null }

    const comparison = {
      pros_cons: [
        { pros: ['Better warranty'], cons: ['Higher price'] },
        { pros: ['Lower price'], cons: ['Shorter warranty'] },
      ],
      comparison: 'Both vendors offer similar scope.',
      recommendation: 'BuildCo offers better value.',
    }
    mockCompareBids.mockResolvedValueOnce(comparison)

    const req = new NextRequest('http://localhost/api/bids/compare', {
      method: 'POST',
      body: JSON.stringify({ bid_ids: ['b-1', 'b-2'] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.comparison).toBe('Both vendors offer similar scope.')
    expect(json.data.recommendation).toBe('BuildCo offers better value.')
    expect(json.data.bids).toHaveLength(2)
    expect(mockCompareBids).toHaveBeenCalled()
  })
})
