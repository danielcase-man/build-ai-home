import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetProject, mockUpdateProjectStatus } = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockUpdateProjectStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
  updateProjectStatus: mockUpdateProjectStatus,
}))

import { POST } from './route'

describe('POST /api/project-status/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('generates status for existing project', async () => {
    mockGetProject.mockResolvedValueOnce({ id: 'proj-1' })

    const res = await POST()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.projectId).toBe('proj-1')
    expect(mockUpdateProjectStatus).toHaveBeenCalledWith('proj-1')
  })

  it('returns error when no project', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await POST()
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
