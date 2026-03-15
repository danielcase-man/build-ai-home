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

import { getWarranties, getExpiringWarranties, getComplianceGaps, createWarranty, verifyCompliance } from './warranty-service'

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

describe('Warranty Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  describe('getWarranties', () => {
    it('auto-computes status based on end_date', async () => {
      const now = new Date()
      const past = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
      const soon = new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0]
      const future = new Date(now.getTime() + 365 * 86400000).toISOString().split('T')[0]

      const warranties = [
        { id: 'w1', end_date: past, status: 'active' },
        { id: 'w2', end_date: soon, status: 'active' },
        { id: 'w3', end_date: future, status: 'active' },
        { id: 'w4', end_date: past, status: 'claimed' },
      ]
      mockSequentialResponses([{ data: warranties }])

      const result = await getWarranties('proj-001')
      expect(result[0].status).toBe('expired')
      expect(result[1].status).toBe('expiring_soon')
      expect(result[2].status).toBe('active')
      expect(result[3].status).toBe('claimed') // claimed stays claimed
    })
  })

  describe('getExpiringWarranties', () => {
    it('returns only expiring_soon warranties', async () => {
      const soon = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
      const future = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]

      mockSequentialResponses([{ data: [
        { id: 'w1', end_date: soon, status: 'active' },
        { id: 'w2', end_date: future, status: 'active' },
      ]}])

      const result = await getExpiringWarranties('proj-001')
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('expiring_soon')
    })
  })

  describe('getComplianceGaps', () => {
    it('categorizes compliance records by status', async () => {
      const past = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const soon = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
      const future = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]

      const compliance = [
        { id: 'c1', expiration_date: past, verified: true },
        { id: 'c2', expiration_date: soon, verified: true },
        { id: 'c3', expiration_date: future, verified: false },
      ]
      mockSequentialResponses([{ data: compliance }])

      const gaps = await getComplianceGaps('proj-001')
      expect(gaps.expired).toHaveLength(1)
      expect(gaps.expiring_soon).toHaveLength(1)
      expect(gaps.unverified).toHaveLength(1)
    })
  })

  describe('createWarranty', () => {
    it('creates a warranty', async () => {
      mockChain.single.mockResolvedValueOnce({ data: { id: 'w-new' }, error: null })

      const result = await createWarranty({
        project_id: 'proj-001',
        vendor_id: null,
        vendor_name: 'Acme',
        category: 'Roofing',
        item_description: '30-year shingles',
        warranty_type: 'manufacturer',
        start_date: '2026-06-01',
        end_date: '2056-06-01',
        duration_months: 360,
        coverage_details: null,
        status: 'active',
      })
      expect(result).toBeDefined()
    })
  })

  describe('verifyCompliance', () => {
    it('marks compliance as verified', async () => {
      mockSequentialResponses([{ data: null }])
      const success = await verifyCompliance('c-1')
      expect(success).toBe(true)
    })
  })
})
