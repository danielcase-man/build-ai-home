import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockResearch,
  mockResearchVendors,
  mockResearchMaterials,
  mockResearchCodeRequirements,
  mockGetCachedResearchResults,
  mockClearExpiredCache,
} = vi.hoisted(() => ({
  mockResearch: vi.fn(),
  mockResearchVendors: vi.fn(),
  mockResearchMaterials: vi.fn(),
  mockResearchCodeRequirements: vi.fn(),
  mockGetCachedResearchResults: vi.fn(),
  mockClearExpiredCache: vi.fn(),
}))

vi.mock('@/lib/research-service', () => ({
  research: mockResearch,
  researchVendors: mockResearchVendors,
  researchMaterials: mockResearchMaterials,
  researchCodeRequirements: mockResearchCodeRequirements,
  getCachedResearchResults: mockGetCachedResearchResults,
  clearExpiredCache: mockClearExpiredCache,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST } from './route'

describe('GET /api/research', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns cached research results', async () => {
    const results = [
      {
        id: 'r-1',
        query: 'plumbing contractors',
        search_type: 'vendor',
        ai_analysis: 'Found 3 plumbing contractors.',
        sources: [{ url: 'https://example.com', title: 'Plumber' }],
        results: { contractors: [] },
        knowledge_id: null,
        expires_at: '2026-04-01',
        created_at: '2026-03-22',
      },
    ]
    mockGetCachedResearchResults.mockResolvedValueOnce(results)

    const req = new NextRequest('http://localhost/api/research')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(1)
    expect(json.data.results[0].query).toBe('plumbing contractors')
  })

  it('filters by knowledge_id and type', async () => {
    mockGetCachedResearchResults.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/research?knowledge_id=k-1&type=vendor')
    await GET(req)

    expect(mockGetCachedResearchResults).toHaveBeenCalledWith('proj-1', {
      knowledgeId: 'k-1',
      searchType: 'vendor',
    })
  })

  it('returns empty when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/research')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.results).toEqual([])
  })
})

describe('POST /api/research', () => {
  beforeEach(() => vi.clearAllMocks())

  it('executes a general research query', async () => {
    const result = {
      query: 'best insulation for Texas',
      search_type: 'general',
      ai_analysis: 'Spray foam is recommended.',
      sources: [],
      results: {},
      knowledge_id: null,
      expires_at: '2026-04-01',
    }
    mockResearch.mockResolvedValueOnce(result)

    const req = new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ query: 'best insulation for Texas' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.query).toBe('best insulation for Texas')
    expect(json.data.ai_analysis).toBe('Spray foam is recommended.')
  })

  it('routes vendor type to researchVendors', async () => {
    const result = {
      query: 'plumbing contractors and vendors near Liberty Hill, TX',
      search_type: 'vendor',
      ai_analysis: 'Top plumbers found.',
      sources: [],
      results: {},
      knowledge_id: null,
      expires_at: '2026-04-01',
    }
    mockResearchVendors.mockResolvedValueOnce(result)

    const req = new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ query: 'plumbing', type: 'vendor' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockResearchVendors).toHaveBeenCalledWith('proj-1', 'plumbing')
  })

  it('routes material type to researchMaterials', async () => {
    const result = {
      query: 'hardwood flooring materials',
      search_type: 'material',
      ai_analysis: 'Options listed.',
      sources: [],
      results: {},
      knowledge_id: null,
      expires_at: '2026-04-01',
    }
    mockResearchMaterials.mockResolvedValueOnce(result)

    const req = new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ query: 'hardwood flooring', type: 'material' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockResearchMaterials).toHaveBeenCalledWith('proj-1', 'hardwood flooring')
  })

  it('routes code type to researchCodeRequirements', async () => {
    const result = {
      query: 'electrical building code',
      search_type: 'code',
      ai_analysis: 'NEC requirements listed.',
      sources: [],
      results: {},
      knowledge_id: null,
      expires_at: '2026-04-01',
    }
    mockResearchCodeRequirements.mockResolvedValueOnce(result)

    const req = new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ query: 'electrical', type: 'code' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockResearchCodeRequirements).toHaveBeenCalledWith('proj-1', 'electrical')
  })

  it('clears expired cache', async () => {
    mockClearExpiredCache.mockResolvedValueOnce(3)

    const req = new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear_expired' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.cleared).toBe(3)
  })

  it('returns validation error when missing query', async () => {
    const req = new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ type: 'vendor' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns validation error for invalid type', async () => {
    const req = new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ query: 'something', type: 'bogus' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns error when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
