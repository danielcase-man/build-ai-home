import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetFinancialOverview, mockGetVendorBalances, mockGetProject } = vi.hoisted(() => ({
  mockGetFinancialOverview: vi.fn(),
  mockGetVendorBalances: vi.fn(),
  mockGetProject: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/financial-service', () => ({
  getFinancialOverview: mockGetFinancialOverview,
  getVendorBalances: mockGetVendorBalances,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

import { GET } from './route'

describe('GET /api/payments/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('returns financial overview with vendor balances', async () => {
    const overview = {
      totalBudget: 1500000,
      totalContracted: 800000,
      totalInvoiced: 200000,
      totalPaid: 150000,
    }
    const vendorBalances = [
      { vendor_id: 'v-1', vendor_name: 'ABC Concrete', contracted: 50000, invoiced: 20000, paid: 10000 },
    ]
    mockGetFinancialOverview.mockResolvedValueOnce(overview)
    mockGetVendorBalances.mockResolvedValueOnce(vendorBalances)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.totalBudget).toBe(1500000)
    expect(json.data.totalPaid).toBe(150000)
    expect(json.data.vendorBalances).toEqual(vendorBalances)
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when service throws', async () => {
    mockGetFinancialOverview.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
