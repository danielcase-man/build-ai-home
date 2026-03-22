import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSyncAll, mockGetProject } = vi.hoisted(() => ({
  mockSyncAll: vi.fn(),
  mockGetProject: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/env', () => ({
  env: { jobtreadApiKey: 'jt-key-123' },
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

vi.mock('@/lib/jobtread-sync', () => ({
  JobTreadSyncService: class {
    syncAll = mockSyncAll
  },
}))

import { POST } from './route'

describe('POST /api/jobtread/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockSyncAll.mockResolvedValue({
      totalCreated: 4,
      totalUpdated: 2,
      totalErrors: 0,
      results: [],
      durationMs: 800,
    })
  })

  it('completes sync successfully', async () => {
    const res = await POST()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.totalCreated).toBe(4)
    expect(json.data.totalUpdated).toBe(2)
    expect(json.data.message).toContain('4 created')
    expect(json.data.message).toContain('2 updated')
    expect(mockSyncAll).toHaveBeenCalled()
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns success with message when JobTread not configured', async () => {
    // Re-mock env with no key
    const envMod = await import('@/lib/env')
    Object.defineProperty(envMod.env, 'jobtreadApiKey', { get: () => undefined, configurable: true })

    const res = await POST()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.message).toBe('JobTread not configured')

    // Restore
    Object.defineProperty(envMod.env, 'jobtreadApiKey', { get: () => 'jt-key-123', configurable: true })
  })

  it('returns error when sync throws', async () => {
    mockSyncAll.mockRejectedValueOnce(new Error('Sync failed'))

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
