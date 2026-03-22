import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetProject,
  mockUpdateProjectStatus,
  mockSyncAll,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockUpdateProjectStatus: vi.fn(),
  mockSyncAll: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/env', () => ({
  env: { cronSecret: 'cron-secret', jobtreadApiKey: 'jt-key-123' },
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
  updateProjectStatus: mockUpdateProjectStatus,
}))

vi.mock('@/lib/jobtread-sync', () => {
  return {
    JobTreadSyncService: class {
      syncAll = mockSyncAll
    },
  }
})

vi.mock('@/lib/reconciler', () => {
  return {
    ProjectReconciler: class {
      reconcileAll = vi.fn().mockResolvedValue({ changes: [], duration: 0 })
    },
  }
})

import { POST, GET } from './route'

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/cron/sync-jobtread', {
    method: 'POST',
    headers,
  })
}

describe('POST /api/cron/sync-jobtread', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockUpdateProjectStatus.mockResolvedValue(undefined)
    mockSyncAll.mockResolvedValue({
      totalCreated: 5,
      totalUpdated: 3,
      totalErrors: 0,
      results: [],
      durationMs: 1200,
    })
  })

  it('rejects missing auth header', async () => {
    const res = await POST(makeReq())
    expect(res.status).toBe(401)
  })

  it('rejects invalid token', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('completes sync successfully', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toBe('JobTread cron sync completed')
    expect(json.data.totalCreated).toBe(5)
    expect(json.data.totalUpdated).toBe(3)
    expect(mockSyncAll).toHaveBeenCalled()
    expect(mockUpdateProjectStatus).toHaveBeenCalledWith('proj-1')
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('GET delegates to POST', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/sync-jobtread', {
      method: 'GET',
      headers: { authorization: 'Bearer cron-secret' },
    })
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.totalCreated).toBe(5)
  })
})
