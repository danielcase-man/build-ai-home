import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetPunchList, mockGetPunchListStats, mockCreatePunchItem, mockUpdatePunchItem, mockMarkPunchResolved } = vi.hoisted(() => ({
  mockGetPunchList: vi.fn(),
  mockGetPunchListStats: vi.fn(),
  mockCreatePunchItem: vi.fn(),
  mockUpdatePunchItem: vi.fn(),
  mockMarkPunchResolved: vi.fn(),
}))

vi.mock('@/lib/punch-list-service', () => ({
  getPunchList: mockGetPunchList,
  getPunchListStats: mockGetPunchListStats,
  createPunchItem: mockCreatePunchItem,
  updatePunchItem: mockUpdatePunchItem,
  markPunchResolved: mockMarkPunchResolved,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST, PATCH } from './route'

describe('GET /api/punch-list', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns punch list items', async () => {
    const items = [
      { id: 'p-1', description: 'Scratch on wall', severity: 'cosmetic' },
      { id: 'p-2', description: 'Leaky faucet', severity: 'functional' },
    ]
    mockGetPunchList.mockResolvedValueOnce(items)

    const req = new NextRequest('http://localhost/api/punch-list')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.items).toEqual(items)
  })

  it('returns stats when view=stats', async () => {
    const stats = { total: 10, identified: 4, in_progress: 3, resolved: 3 }
    mockGetPunchListStats.mockResolvedValueOnce(stats)

    const req = new NextRequest('http://localhost/api/punch-list?view=stats')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(stats)
  })
})

describe('POST /api/punch-list', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing description', async () => {
    const req = new NextRequest('http://localhost/api/punch-list', {
      method: 'POST',
      body: JSON.stringify({ room: 'Kitchen' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('creates punch item', async () => {
    const created = {
      id: 'p-new',
      description: 'Drywall crack',
      severity: 'functional',
      status: 'identified',
      room: 'Living Room',
    }
    mockCreatePunchItem.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/punch-list', {
      method: 'POST',
      body: JSON.stringify({
        description: 'Drywall crack',
        room: 'Living Room',
        severity: 'functional',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.item).toEqual(created)
  })
})

describe('PATCH /api/punch-list', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing id', async () => {
    const req = new NextRequest('http://localhost/api/punch-list', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('updates punch item status', async () => {
    mockUpdatePunchItem.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/punch-list', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'p-1', status: 'in_progress' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
  })

  it('resolves punch item with after_photo_id', async () => {
    mockMarkPunchResolved.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/punch-list', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'p-1', action: 'resolve', after_photo_id: 'photo-123' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
    expect(mockMarkPunchResolved).toHaveBeenCalledWith('p-1', 'photo-123')
  })
})
