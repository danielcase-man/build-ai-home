import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetProjectStatus } = vi.hoisted(() => ({
  mockGetProjectStatus: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProjectStatus: mockGetProjectStatus,
}))

import { GET } from './route'

describe('GET /api/project-status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns project status', async () => {
    const status = { phase: 'planning', stepNumber: 3, totalSteps: 6 }
    mockGetProjectStatus.mockResolvedValueOnce(status)

    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.status.phase).toBe('planning')
  })

  it('returns null status when no project', async () => {
    mockGetProjectStatus.mockResolvedValueOnce(null)

    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.status).toBeNull()
  })
})
