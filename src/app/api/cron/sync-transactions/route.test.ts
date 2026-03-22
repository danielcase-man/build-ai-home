import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetProject,
  mockSyncAllConnections,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockSyncAllConnections: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

vi.mock('@/lib/plaid-sync', () => ({
  syncAllConnections: mockSyncAllConnections,
}))

import { POST, GET } from './route'

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/cron/sync-transactions', {
    method: 'POST',
    headers,
  })
}

describe('POST /api/cron/sync-transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set CRON_SECRET for auth check
    process.env.CRON_SECRET = 'cron-secret'
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockSyncAllConnections.mockResolvedValue({
      added: 10,
      modified: 2,
      removed: 1,
      autoMatched: 5,
      errors: [],
    })
  })

  it('rejects invalid token', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 404 when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('No project found')
  })

  it('syncs transactions successfully', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.added).toBe(10)
    expect(json.modified).toBe(2)
    expect(json.removed).toBe(1)
    expect(json.autoMatched).toBe(5)
    expect(mockSyncAllConnections).toHaveBeenCalledWith('proj-1')
  })

  it('returns 500 when sync throws', async () => {
    mockSyncAllConnections.mockRejectedValueOnce(new Error('Plaid API down'))

    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Plaid API down')
  })

  it('GET delegates to POST', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/sync-transactions', {
      method: 'GET',
      headers: { authorization: 'Bearer cron-secret' },
    })
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.added).toBe(10)
  })
})
