import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetProject = vi.fn()
const mockGetSelectionDecisionQueue = vi.fn()

vi.mock('@/lib/project-service', () => ({ getProject: () => mockGetProject() }))
vi.mock('@/lib/selection-decision-service', () => ({
  getSelectionDecisionQueue: (...a: unknown[]) => mockGetSelectionDecisionQueue(...a),
}))

import { GET } from './route'

describe('GET /api/selections/decision-queue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns decision queue data', async () => {
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockGetSelectionDecisionQueue.mockResolvedValue({
      decisionQueue: [],
      lockedIn: [],
      future: [],
      activePhase: 1,
      activePhaseName: 'Pre-Construction',
    })

    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.activePhase).toBe(1)
    expect(mockGetSelectionDecisionQueue).toHaveBeenCalledWith('proj-1')
  })

  it('returns error when no project', async () => {
    mockGetProject.mockResolvedValue(null)
    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('No project found')
  })

  it('handles service errors', async () => {
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockGetSelectionDecisionQueue.mockRejectedValue(new Error('DB down'))

    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
