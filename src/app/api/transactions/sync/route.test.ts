import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { POST } from './route'

describe('POST /api/transactions/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockSyncAllConnections.mockResolvedValue({
      added: 8,
      modified: 3,
      removed: 0,
      autoMatched: 4,
      errors: [],
    })
  })

  it('syncs transactions successfully', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.added).toBe(8)
    expect(json.data.modified).toBe(3)
    expect(json.data.removed).toBe(0)
    expect(json.data.autoMatched).toBe(4)
    expect(mockSyncAllConnections).toHaveBeenCalledWith('proj-1')
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('No project found')
  })

  it('returns error when project has no id', async () => {
    mockGetProject.mockResolvedValueOnce({ id: undefined })

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('No project found')
  })

  it('returns error when sync throws', async () => {
    mockSyncAllConnections.mockRejectedValueOnce(new Error('Plaid API down'))

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe('Failed to sync transactions')
  })
})
