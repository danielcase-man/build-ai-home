import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetEntityHistory } = vi.hoisted(() => ({
  mockGetEntityHistory: vi.fn(),
}))

vi.mock('@/lib/audit-service', () => ({
  getEntityHistory: mockGetEntityHistory,
}))

import { GET } from './route'

describe('GET /api/audit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty entries when entityType is missing', async () => {
    const req = new NextRequest('http://localhost/api/audit?entityId=e-1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.entries).toEqual([])
    expect(mockGetEntityHistory).not.toHaveBeenCalled()
  })

  it('returns empty entries when entityId is missing', async () => {
    const req = new NextRequest('http://localhost/api/audit?entityType=workflow_item')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.entries).toEqual([])
    expect(mockGetEntityHistory).not.toHaveBeenCalled()
  })

  it('returns empty entries when no params provided', async () => {
    const req = new NextRequest('http://localhost/api/audit')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.entries).toEqual([])
  })

  it('returns audit entries for entity', async () => {
    const entries = [
      {
        id: 'a-1',
        project_id: 'proj-1',
        entity_type: 'workflow_item',
        entity_id: 'k-1',
        action: 'update',
        field_name: 'status',
        old_value: 'not_started',
        new_value: 'in_progress',
        actor: 'user',
        created_at: '2026-03-20T10:00:00Z',
      },
      {
        id: 'a-2',
        project_id: 'proj-1',
        entity_type: 'workflow_item',
        entity_id: 'k-1',
        action: 'update',
        field_name: 'status',
        old_value: 'in_progress',
        new_value: 'completed',
        actor: 'user',
        created_at: '2026-03-21T14:00:00Z',
      },
    ]
    mockGetEntityHistory.mockResolvedValueOnce(entries)

    const req = new NextRequest('http://localhost/api/audit?entityType=workflow_item&entityId=k-1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.entries).toEqual(entries)
    expect(json.data.entries).toHaveLength(2)
    expect(mockGetEntityHistory).toHaveBeenCalledWith('workflow_item', 'k-1')
  })

  it('returns error when service throws', async () => {
    mockGetEntityHistory.mockRejectedValueOnce(new Error('DB failure'))

    const req = new NextRequest('http://localhost/api/audit?entityType=workflow_item&entityId=k-1')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
