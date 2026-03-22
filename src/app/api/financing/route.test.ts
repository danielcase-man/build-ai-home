import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetActiveConstructionLoan, mockGetConstructionLoanHistory, mockUpsertConstructionLoan } = vi.hoisted(() => ({
  mockGetActiveConstructionLoan: vi.fn(),
  mockGetConstructionLoanHistory: vi.fn(),
  mockUpsertConstructionLoan: vi.fn(),
}))

vi.mock('@/lib/loan-service', () => ({
  getActiveConstructionLoan: mockGetActiveConstructionLoan,
  getConstructionLoanHistory: mockGetConstructionLoanHistory,
  upsertConstructionLoan: mockUpsertConstructionLoan,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST } from './route'

describe('GET /api/financing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns loan data and history', async () => {
    const loan = { id: 'loan-1', lender_name: 'River Bear', status: 'active' }
    const history = [
      { id: 'loan-1', lender_name: 'River Bear', status: 'active' },
    ]
    mockGetActiveConstructionLoan.mockResolvedValueOnce(loan)
    mockGetConstructionLoanHistory.mockResolvedValueOnce(history)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.loan).toEqual(loan)
    expect(json.data.history).toEqual(history)
  })

  it('returns null loan when no project found', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.loan).toBeNull()
    expect(json.data.history).toEqual([])
  })
})

describe('POST /api/financing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates/updates loan and returns result', async () => {
    const loan = { id: 'loan-1', lender_name: 'Federal Savings', status: 'active' }
    const history = [loan]
    mockUpsertConstructionLoan.mockResolvedValueOnce({ loan, history })

    const req = new Request('http://localhost/api/financing', {
      method: 'POST',
      body: JSON.stringify({
        lender_name: 'Federal Savings',
        loan_amount: 500000,
        interest_rate: 7.5,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.loan).toEqual(loan)
    expect(json.data.history).toEqual(history)
  })

  it('returns error when upsert fails (null loan)', async () => {
    mockUpsertConstructionLoan.mockResolvedValueOnce({ loan: null, history: [] })

    const req = new Request('http://localhost/api/financing', {
      method: 'POST',
      body: JSON.stringify({ lender_name: 'Bad Bank' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when no project found', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new Request('http://localhost/api/financing', {
      method: 'POST',
      body: JSON.stringify({ lender_name: 'Test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
