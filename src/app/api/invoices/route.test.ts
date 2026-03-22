import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetInvoices, mockUpsertInvoice, mockGetProject } = vi.hoisted(() => ({
  mockGetInvoices: vi.fn(),
  mockUpsertInvoice: vi.fn(),
  mockGetProject: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/financial-service', () => ({
  getInvoices: mockGetInvoices,
  upsertInvoice: mockUpsertInvoice,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

import { GET, POST } from './route'

describe('GET /api/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('returns invoices', async () => {
    const invoices = [
      { id: 'inv-1', amount: 5000, date_issued: '2026-03-01', status: 'received' },
    ]
    mockGetInvoices.mockResolvedValueOnce(invoices)

    const req = new NextRequest('http://localhost/api/invoices')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.invoices).toEqual(invoices)
  })

  it('passes filter params', async () => {
    mockGetInvoices.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/invoices?vendorId=v-1&contractId=c-1&status=paid')
    await GET(req)
    expect(mockGetInvoices).toHaveBeenCalledWith('proj-1', {
      vendorId: 'v-1',
      contractId: 'c-1',
      status: 'paid',
    })
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/invoices')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('POST /api/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('creates an invoice', async () => {
    const created = { id: 'inv-new', amount: 8000, date_issued: '2026-03-15', status: 'received' }
    mockUpsertInvoice.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        amount: 8000,
        date_issued: '2026-03-15',
        vendor_id: 'v-1',
        description: 'Foundation work',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.invoice).toEqual(created)
    expect(mockUpsertInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        amount: 8000,
        date_issued: '2026-03-15',
        vendor_id: 'v-1',
        status: 'received',
      })
    )
  })

  it('returns validation error when amount missing', async () => {
    const req = new NextRequest('http://localhost/api/invoices', {
      method: 'POST',
      body: JSON.stringify({ date_issued: '2026-03-15' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns validation error when date_issued missing', async () => {
    const req = new NextRequest('http://localhost/api/invoices', {
      method: 'POST',
      body: JSON.stringify({ amount: 5000 }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/invoices', {
      method: 'POST',
      body: JSON.stringify({ amount: 5000, date_issued: '2026-03-15' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('defaults tax_amount to 0 and total_amount to amount', async () => {
    mockUpsertInvoice.mockResolvedValueOnce({ id: 'inv-1' })

    const req = new NextRequest('http://localhost/api/invoices', {
      method: 'POST',
      body: JSON.stringify({ amount: 3000, date_issued: '2026-03-10' }),
    })

    await POST(req)
    expect(mockUpsertInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        tax_amount: 0,
        total_amount: 3000,
      })
    )
  })
})
