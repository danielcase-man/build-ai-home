import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetBlockers, mockGetReadyItems } = vi.hoisted(() => ({
  mockGetBlockers: vi.fn(),
  mockGetReadyItems: vi.fn(),
}))

vi.mock('@/lib/knowledge-graph', () => ({
  getBlockers: mockGetBlockers,
  getReadyItems: mockGetReadyItems,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET } from './route'

describe('GET /api/knowledge/blockers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns blockers and ready items', async () => {
    const blockers = [
      {
        item: { id: 'k-1', item_name: 'Electrical Rough-In', trade: 'electrical', phase_number: 7 },
        state: { status: 'blocked' },
        unmetDependencies: [
          { id: 'k-0', item_name: 'Framing Complete', trade: 'carpentry' },
        ],
      },
    ]
    const readyItems = [
      {
        id: 'k-2',
        item_name: 'Foundation Pour',
        trade: 'concrete',
        phase_number: 5,
        item_type: 'task',
        typical_duration_days: 3,
      },
    ]
    mockGetBlockers.mockResolvedValueOnce(blockers)
    mockGetReadyItems.mockResolvedValueOnce(readyItems)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.blockers).toHaveLength(1)
    expect(json.data.blockers[0].item.id).toBe('k-1')
    expect(json.data.blockers[0].unmet_dependencies).toHaveLength(1)
    expect(json.data.blockers[0].unmet_dependencies[0].item_name).toBe('Framing Complete')
    expect(json.data.ready).toHaveLength(1)
    expect(json.data.ready[0].id).toBe('k-2')
  })

  it('returns empty when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.blockers).toEqual([])
    expect(json.data.ready).toEqual([])
  })

  it('returns empty arrays when no blockers or ready items', async () => {
    mockGetBlockers.mockResolvedValueOnce([])
    mockGetReadyItems.mockResolvedValueOnce([])

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.blockers).toEqual([])
    expect(json.data.ready).toEqual([])
  })

  it('returns 500 on error', async () => {
    mockGetBlockers.mockRejectedValueOnce(new Error('DB error'))

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
