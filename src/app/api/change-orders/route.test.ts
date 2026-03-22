import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetChangeOrders, mockGetChangeOrderSummary, mockCreateChangeOrder, mockUpdateChangeOrder } = vi.hoisted(() => ({
  mockGetChangeOrders: vi.fn(),
  mockGetChangeOrderSummary: vi.fn(),
  mockCreateChangeOrder: vi.fn(),
  mockUpdateChangeOrder: vi.fn(),
}))

vi.mock('@/lib/change-order-service', () => ({
  getChangeOrders: mockGetChangeOrders,
  getChangeOrderSummary: mockGetChangeOrderSummary,
  createChangeOrder: mockCreateChangeOrder,
  updateChangeOrder: mockUpdateChangeOrder,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST, PATCH } from './route'

describe('GET /api/change-orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns change orders', async () => {
    const orders = [
      { id: 'co-1', title: 'Add outlet', reason: 'owner_request' },
      { id: 'co-2', title: 'Move wall', reason: 'design_error' },
    ]
    mockGetChangeOrders.mockResolvedValueOnce(orders)

    const req = new NextRequest('http://localhost/api/change-orders')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.change_orders).toEqual(orders)
  })

  it('returns summary when view=summary', async () => {
    const summary = { total: 5, approved: 3, pending: 2, total_cost_impact: 12000 }
    mockGetChangeOrderSummary.mockResolvedValueOnce(summary)

    const req = new NextRequest('http://localhost/api/change-orders?view=summary')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(summary)
  })
})

describe('POST /api/change-orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing required fields', async () => {
    const req = new NextRequest('http://localhost/api/change-orders', {
      method: 'POST',
      body: JSON.stringify({ title: 'Add outlet' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('creates change order', async () => {
    const created = {
      id: 'co-new',
      title: 'Add outlet',
      reason: 'owner_request',
      status: 'draft',
      cost_impact: 500,
    }
    mockCreateChangeOrder.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/change-orders', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Add outlet',
        reason: 'owner_request',
        cost_impact: 500,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.change_order).toEqual(created)
  })
})

describe('PATCH /api/change-orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing id', async () => {
    const req = new NextRequest('http://localhost/api/change-orders', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('updates change order', async () => {
    mockUpdateChangeOrder.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/change-orders', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'co-1', status: 'approved' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
  })
})
