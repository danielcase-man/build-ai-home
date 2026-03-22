import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetProject,
  mockUpdateProjectStatus,
  mockGetWorkflowAlerts,
  mockCreateWorkflowAlertNotification,
  mockGetFollowUpsNeeded,
  mockGetExpiringWarranties,
  mockGetComplianceGaps,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockUpdateProjectStatus: vi.fn(),
  mockGetWorkflowAlerts: vi.fn(),
  mockCreateWorkflowAlertNotification: vi.fn(),
  mockGetFollowUpsNeeded: vi.fn(),
  mockGetExpiringWarranties: vi.fn(),
  mockGetComplianceGaps: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/env', () => ({
  env: { cronSecret: 'cron-secret' },
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
  updateProjectStatus: mockUpdateProjectStatus,
}))

vi.mock('@/lib/workflow-service', () => ({
  getWorkflowAlerts: mockGetWorkflowAlerts,
}))

vi.mock('@/lib/notification-service', () => ({
  createWorkflowAlertNotification: mockCreateWorkflowAlertNotification,
}))

vi.mock('@/lib/vendor-thread-service', () => ({
  getFollowUpsNeeded: mockGetFollowUpsNeeded,
}))

vi.mock('@/lib/warranty-service', () => ({
  getExpiringWarranties: mockGetExpiringWarranties,
  getComplianceGaps: mockGetComplianceGaps,
}))

import { POST, GET } from './route'

// Stub global fetch for internal cron calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/cron/daily-status', {
    method: 'POST',
    headers,
  })
}

describe('POST /api/cron/daily-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockUpdateProjectStatus.mockResolvedValue(undefined)
    mockGetWorkflowAlerts.mockResolvedValue([])
    mockCreateWorkflowAlertNotification.mockResolvedValue(undefined)
    mockGetFollowUpsNeeded.mockResolvedValue([])
    mockGetExpiringWarranties.mockResolvedValue([])
    mockGetComplianceGaps.mockResolvedValue({ missing: [], expired: [], expiring_soon: [] })
    mockFetch.mockResolvedValue({
      json: async () => ({ data: { synced: 0 } }),
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

  it('runs full daily status successfully', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toBe('Daily status update complete')
    expect(Array.isArray(json.data.results)).toBe(true)
    expect(mockUpdateProjectStatus).toHaveBeenCalledWith('proj-1')
  })

  it('skips status snapshot when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.results).toContain('Status snapshot: skipped (no project)')
    expect(mockUpdateProjectStatus).not.toHaveBeenCalled()
  })

  it('continues when email sync fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    // Second call (JT sync) succeeds
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { totalCreated: 0, totalUpdated: 0 } }),
    })

    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.results).toEqual(
      expect.arrayContaining([expect.stringContaining('Email sync failed')])
    )
  })

  it('creates notifications for workflow blockers', async () => {
    mockGetWorkflowAlerts.mockResolvedValueOnce([
      { type: 'blocker', title: 'Blocked: Permit', message: 'Awaiting permit approval' },
    ])

    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockCreateWorkflowAlertNotification).toHaveBeenCalledWith(
      'proj-1',
      'blocker',
      'Permit',
      'Awaiting permit approval'
    )
  })

  it('GET delegates to POST', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/daily-status', {
      method: 'GET',
      headers: { authorization: 'Bearer cron-secret' },
    })
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
