import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetPayments, mockCreatePayment } = vi.hoisted(() => ({
  mockGetPayments: vi.fn(),
  mockCreatePayment: vi.fn(),
}))

vi.mock('@/lib/financial-service', () => ({
  getPayments: mockGetPayments,
  createPayment: mockCreatePayment,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST } from './route'

describe('GET /api/payments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all payments', async () => {
    const payments = [
      { id: 'p-1', amount: 5000, date: '2026-03-01', payment_method: 'check' },
      { id: 'p-2', amount: 12000, date: '2026-03-10', payment_method: 'wire' },
    ]
    mockGetPayments.mockResolvedValueOnce(payments)

    const req = new NextRequest('http://localhost/api/payments')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.payments).toEqual(payments)
  })

  it('passes vendorId filter', async () => {
    mockGetPayments.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/payments?vendorId=v-1')
    await GET(req)
    expect(mockGetPayments).toHaveBeenCalledWith('proj-1', {
      vendorId: 'v-1',
      invoiceId: undefined,
      contractId: undefined,
    })
  })

  it('passes invoiceId filter', async () => {
    mockGetPayments.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/payments?invoiceId=inv-1')
    await GET(req)
    expect(mockGetPayments).toHaveBeenCalledWith('proj-1', {
      vendorId: undefined,
      invoiceId: 'inv-1',
      contractId: undefined,
    })
  })

  it('passes contractId filter', async () => {
    mockGetPayments.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/payments?contractId=c-1')
    await GET(req)
    expect(mockGetPayments).toHaveBeenCalledWith('proj-1', {
      vendorId: undefined,
      invoiceId: undefined,
      contractId: 'c-1',
    })
  })

  it('returns error when no project found', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/payments')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('POST /api/payments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing amount', async () => {
    const req = new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      body: JSON.stringify({ date: '2026-03-20' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns validation error when missing date', async () => {
    const req = new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      body: JSON.stringify({ amount: 5000 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('creates payment', async () => {
    const created = {
      id: 'p-new',
      amount: 8000,
      date: '2026-03-20',
      payment_method: 'check',
      source: 'manual',
    }
    mockCreatePayment.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        amount: 8000,
        date: '2026-03-20',
        vendor_id: 'v-1',
        payment_method: 'check',
        notes: 'Foundation draw payment',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.payment).toEqual(created)
  })
})
