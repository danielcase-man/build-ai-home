import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetDrawSchedule,
  mockGetDrawSummary,
  mockCreateDraw,
  mockUpdateDrawStatus,
} = vi.hoisted(() => ({
  mockGetDrawSchedule: vi.fn(),
  mockGetDrawSummary: vi.fn(),
  mockCreateDraw: vi.fn(),
  mockUpdateDrawStatus: vi.fn(),
}))

vi.mock('@/lib/draw-schedule-service', () => ({
  getDrawSchedule: mockGetDrawSchedule,
  getDrawSummary: mockGetDrawSummary,
  createDraw: mockCreateDraw,
  updateDrawStatus: mockUpdateDrawStatus,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST, PATCH } from './route'

describe('GET /api/draw-schedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns draws', async () => {
    const draws = [
      { id: 'd-1', amount: 50000, status: 'pending', milestone_name: 'Foundation' },
      { id: 'd-2', amount: 75000, status: 'funded', milestone_name: 'Framing' },
    ]
    mockGetDrawSchedule.mockResolvedValueOnce(draws)

    const req = new NextRequest('http://localhost/api/draw-schedule')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.draws).toEqual(draws)
  })

  it('returns summary when view=summary', async () => {
    const summary = {
      total_draws: 5,
      total_amount: 250000,
      funded_amount: 125000,
      pending_amount: 125000,
    }
    mockGetDrawSummary.mockResolvedValueOnce(summary)

    const req = new NextRequest('http://localhost/api/draw-schedule?view=summary')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(summary)
  })

  it('returns empty draws when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/draw-schedule')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.draws).toEqual([])
  })
})

describe('POST /api/draw-schedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing amount', async () => {
    const req = new NextRequest('http://localhost/api/draw-schedule', {
      method: 'POST',
      body: JSON.stringify({ milestone_name: 'Foundation' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('creates draw', async () => {
    const created = {
      id: 'd-new',
      amount: 60000,
      status: 'pending',
      milestone_name: 'Rough-in',
    }
    mockCreateDraw.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/draw-schedule', {
      method: 'POST',
      body: JSON.stringify({
        amount: 60000,
        milestone_name: 'Rough-in',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.draw).toEqual(created)
  })

  it('returns error when insert fails', async () => {
    mockCreateDraw.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/draw-schedule', {
      method: 'POST',
      body: JSON.stringify({ amount: 50000 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('PATCH /api/draw-schedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing id or status', async () => {
    const req = new NextRequest('http://localhost/api/draw-schedule', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('updates draw status', async () => {
    mockUpdateDrawStatus.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/draw-schedule', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'd-1', status: 'approved', approval_date: '2026-03-20' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
    expect(mockUpdateDrawStatus).toHaveBeenCalledWith('d-1', 'approved', {
      id: 'd-1',
      status: 'approved',
      approval_date: '2026-03-20',
    })
  })
})
