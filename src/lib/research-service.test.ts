import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

// Supabase mock
const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'gte', 'lt', 'order', 'limit', 'single', 'from', 'is'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

// Anthropic mock
const mockCreate = vi.fn()

vi.mock('./ai-clients', () => ({
  getAnthropicClient: () => ({
    messages: { create: mockCreate },
  }),
  parseAIJsonResponse: (text: string) => {
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '')
    }
    return JSON.parse(jsonText)
  },
}))

import {
  research,
  researchVendors,
  researchMaterials,
  researchCodeRequirements,
  researchWithContext,
  getCachedResearchResults,
  clearExpiredCache,
} from './research-service'

// Helpers
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

function mockAnthropicResearchResponse(analysisText: string) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          summary: analysisText,
          findings: [{ title: 'Finding 1', details: 'Detail', relevance: 'high', source: 'web' }],
          recommendations: ['Use product X'],
          cost_estimates: { low: 1000, mid: 2000, high: 3000 },
          key_considerations: ['Consider Y'],
          next_steps: ['Get quotes'],
        }),
      },
    ],
  }
}

describe('Research Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  // ── research ─────────────────────────────────────────────────────────

  describe('research', () => {
    it('returns cached result if available', async () => {
      const cached = {
        id: 'rc-001',
        project_id: 'proj-001',
        knowledge_id: null,
        query: 'test query',
        search_type: 'general',
        results: { summary: 'cached analysis' },
        sources: [],
        ai_analysis: 'cached analysis',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      }

      // Mock cache lookup
      mockChain.single.mockResolvedValueOnce({ data: cached, error: null })

      const result = await research({
        projectId: 'proj-001',
        query: 'test query',
        searchType: 'general',
      })

      expect(result.ai_analysis).toBe('cached analysis')
      expect(mockCreate).not.toHaveBeenCalled() // No API call
    })

    it('calls Claude API when no cache hit', async () => {
      // Cache miss
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      // Mock the API response
      mockCreate.mockResolvedValueOnce(mockAnthropicResearchResponse('Fresh research results'))

      // Mock cache write
      mockSequentialResponses([{ data: null }])

      const result = await research({
        projectId: 'proj-001',
        query: 'best foundation for clay soil',
        searchType: 'general',
      })

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(result.ai_analysis).toContain('Fresh research results')
      expect(result.search_type).toBe('general')
    })

    it('passes web_search tool to Claude', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      mockCreate.mockResolvedValueOnce(mockAnthropicResearchResponse('Results'))
      mockSequentialResponses([{ data: null }])

      await research({
        projectId: 'proj-001',
        query: 'test',
        searchType: 'vendor',
      })

      const apiCall = mockCreate.mock.calls[0][0]
      expect(apiCall.tools).toBeDefined()
      expect(apiCall.tools[0].type).toBe('web_search_20250305')
      expect(apiCall.tools[0].name).toBe('web_search')
      expect(apiCall.model).toBe('claude-sonnet-4-6')
    })

    it('sets user_location to Liberty Hill, TX', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      mockCreate.mockResolvedValueOnce(mockAnthropicResearchResponse('Results'))
      mockSequentialResponses([{ data: null }])

      await research({
        projectId: 'proj-001',
        query: 'test',
        searchType: 'vendor',
      })

      const apiCall = mockCreate.mock.calls[0][0]
      expect(apiCall.tools[0].user_location.city).toBe('Liberty Hill')
      expect(apiCall.tools[0].user_location.region).toBe('TX')
    })

    it('handles API errors gracefully', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      mockCreate.mockRejectedValueOnce(new Error('API quota exceeded'))

      const result = await research({
        projectId: 'proj-001',
        query: 'test',
        searchType: 'general',
      })

      expect(result.ai_analysis).toContain('Research failed')
      expect(result.sources).toEqual([])
    })

    it('forces refresh when forceRefresh is true', async () => {
      mockCreate.mockResolvedValueOnce(mockAnthropicResearchResponse('Fresh'))
      mockSequentialResponses([{ data: null }])

      const result = await research({
        projectId: 'proj-001',
        query: 'test',
        searchType: 'general',
        forceRefresh: true,
      })

      // Should NOT check cache
      expect(mockChain.single).not.toHaveBeenCalled()
      expect(mockCreate).toHaveBeenCalledOnce()
      expect(result.ai_analysis).toContain('Fresh')
    })

    it('sets 7-day TTL on cached results', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      mockCreate.mockResolvedValueOnce(mockAnthropicResearchResponse('Results'))
      mockSequentialResponses([{ data: null }])

      const result = await research({
        projectId: 'proj-001',
        query: 'test',
        searchType: 'general',
      })

      const expiresAt = new Date(result.expires_at)
      const now = new Date()
      const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      expect(daysDiff).toBeGreaterThan(6.9)
      expect(daysDiff).toBeLessThan(7.1)
    })
  })

  // ── Specialized research functions ───────────────────────────────────

  describe('researchVendors', () => {
    it('creates vendor-specific query', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      mockCreate.mockResolvedValueOnce(mockAnthropicResearchResponse('Vendor results'))
      mockSequentialResponses([{ data: null }])

      const result = await researchVendors('proj-001', 'Framing')
      expect(result.search_type).toBe('vendor')
      expect(result.query).toContain('Framing')
      expect(result.query).toContain('Liberty Hill, TX')
    })
  })

  describe('researchMaterials', () => {
    it('creates material-specific query with specs', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      mockCreate.mockResolvedValueOnce(mockAnthropicResearchResponse('Material results'))
      mockSequentialResponses([{ data: null }])

      const result = await researchMaterials('proj-001', 'Insulation', 'R-38 blown-in')
      expect(result.search_type).toBe('material')
      expect(result.query).toContain('Insulation')
      expect(result.query).toContain('R-38 blown-in')
    })
  })

  describe('researchCodeRequirements', () => {
    it('creates code-specific query for Williamson County', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      mockCreate.mockResolvedValueOnce(mockAnthropicResearchResponse('Code results'))
      mockSequentialResponses([{ data: null }])

      const result = await researchCodeRequirements('proj-001', 'Electrical')
      expect(result.search_type).toBe('code')
      expect(result.query).toContain('Electrical')
      expect(result.query).toContain('Williamson County')
    })
  })

  describe('researchWithContext', () => {
    it('creates general research with knowledge_id', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      mockCreate.mockResolvedValueOnce(mockAnthropicResearchResponse('Context results'))
      mockSequentialResponses([{ data: null }])

      const result = await researchWithContext('proj-001', 'Best pool finish options', 'ki-pool')
      expect(result.knowledge_id).toBe('ki-pool')
      expect(result.search_type).toBe('general')
    })
  })

  // ── Cache operations ─────────────────────────────────────────────────

  describe('getCachedResearchResults', () => {
    it('fetches cached results with filters', async () => {
      const cached = [
        { id: 'rc-1', query: 'q1', search_type: 'vendor', ai_analysis: 'a1' },
        { id: 'rc-2', query: 'q2', search_type: 'material', ai_analysis: 'a2' },
      ]
      mockSequentialResponses([{ data: cached }])

      const results = await getCachedResearchResults('proj-001', { searchType: 'vendor' })
      expect(results).toHaveLength(2)
      expect(mockChain.eq).toHaveBeenCalledWith('project_id', 'proj-001')
      expect(mockChain.eq).toHaveBeenCalledWith('search_type', 'vendor')
    })
  })

  describe('clearExpiredCache', () => {
    it('deletes expired entries', async () => {
      mockSequentialResponses([{ data: [{ id: 'rc-old-1' }, { id: 'rc-old-2' }] }])

      const count = await clearExpiredCache()
      expect(count).toBe(2)
      expect(mockChain.delete).toHaveBeenCalled()
      expect(mockChain.lt).toHaveBeenCalledWith('expires_at', expect.any(String))
    })
  })
})
