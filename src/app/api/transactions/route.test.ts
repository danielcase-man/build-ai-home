import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetTransactions, mockGetProject } = vi.hoisted(() => ({
  mockGetTransactions: vi.fn(),
  mockGetProject: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/financial-service', () => ({
  getTransactions: mockGetTransactions,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

import { GET } from './route'

describe('GET /api/transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('returns transactions with default filters', async () => {
    const result = { transactions: [{ id: 'tx-1', amount: 500 }], total: 1 }
    mockGetTransactions.mockResolvedValueOnce(result)

    const req = new NextRequest('http://localhost/api/transactions')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(result)
    expect(mockGetTransactions).toHaveBeenCalledWith('proj-1', {
      dateFrom: undefined,
      dateTo: undefined,
      vendorId: undefined,
      matchStatus: undefined,
      isConstructionRelated: undefined,
      search: undefined,
      limit: 50,
      offset: 0,
    })
  })

  it('passes query filters through', async () => {
    mockGetTransactions.mockResolvedValueOnce({ transactions: [], total: 0 })

    const req = new NextRequest(
      'http://localhost/api/transactions?dateFrom=2026-01-01&dateTo=2026-03-01&vendorId=v-1&matchStatus=unmatched&constructionOnly=true&search=lumber&limit=25&offset=10'
    )
    await GET(req)

    expect(mockGetTransactions).toHaveBeenCalledWith('proj-1', {
      dateFrom: '2026-01-01',
      dateTo: '2026-03-01',
      vendorId: 'v-1',
      matchStatus: 'unmatched',
      isConstructionRelated: true,
      search: 'lumber',
      limit: 25,
      offset: 10,
    })
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/transactions')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when getTransactions throws', async () => {
    mockGetTransactions.mockRejectedValueOnce(new Error('DB error'))

    const req = new NextRequest('http://localhost/api/transactions')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
