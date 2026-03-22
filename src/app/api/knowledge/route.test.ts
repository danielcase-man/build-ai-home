import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetKnowledgeTree,
  mockGetDecisionPoints,
  mockSeedKnowledgeGraph,
  mockIsKnowledgeGraphSeeded,
  mockInitializeProjectKnowledgeStates,
} = vi.hoisted(() => ({
  mockGetKnowledgeTree: vi.fn(),
  mockGetDecisionPoints: vi.fn(),
  mockSeedKnowledgeGraph: vi.fn(),
  mockIsKnowledgeGraphSeeded: vi.fn(),
  mockInitializeProjectKnowledgeStates: vi.fn(),
}))

vi.mock('@/lib/knowledge-graph', () => ({
  getKnowledgeTree: mockGetKnowledgeTree,
  getDecisionPoints: mockGetDecisionPoints,
  seedKnowledgeGraph: mockSeedKnowledgeGraph,
  isKnowledgeGraphSeeded: mockIsKnowledgeGraphSeeded,
  initializeProjectKnowledgeStates: mockInitializeProjectKnowledgeStates,
}))

vi.mock('@/lib/knowledge-seed-data', () => ({
  KNOWLEDGE_SEED_DATA: [{ item_name: 'Foundation', trade: 'concrete' }],
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST } from './route'

describe('GET /api/knowledge', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns knowledge tree', async () => {
    const tree = [
      { id: 'k-1', item_name: 'Foundation', trade: 'concrete', children: [] },
      { id: 'k-2', item_name: 'Framing', trade: 'carpentry', children: [] },
    ]
    mockGetKnowledgeTree.mockResolvedValueOnce(tree)

    const req = new NextRequest('http://localhost/api/knowledge')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.tree).toEqual(tree)
  })

  it('filters by phase param', async () => {
    mockGetKnowledgeTree.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/knowledge?phase=3')
    await GET(req)

    expect(mockGetKnowledgeTree).toHaveBeenCalledWith('proj-1', {
      phase_number: 3,
      trade: undefined,
    })
  })

  it('filters by trade param', async () => {
    mockGetKnowledgeTree.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/knowledge?trade=plumbing')
    await GET(req)

    expect(mockGetKnowledgeTree).toHaveBeenCalledWith('proj-1', {
      phase_number: undefined,
      trade: 'plumbing',
    })
  })

  it('returns decisions when type=decisions', async () => {
    const decisions = [
      {
        item: { id: 'k-1', item_name: 'Choose HVAC', trade: 'hvac' },
        state: { status: 'pending' },
      },
    ]
    mockGetDecisionPoints.mockResolvedValueOnce(decisions)

    const req = new NextRequest('http://localhost/api/knowledge?type=decisions')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(1)
    expect(json.data.decisions[0].id).toBe('k-1')
    expect(json.data.decisions[0].state).toEqual({ status: 'pending' })
  })

  it('filters decisions by phase', async () => {
    mockGetDecisionPoints.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/knowledge?type=decisions&phase=5')
    await GET(req)

    expect(mockGetDecisionPoints).toHaveBeenCalledWith('proj-1', 5)
  })
})

describe('POST /api/knowledge', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seeds knowledge graph', async () => {
    mockIsKnowledgeGraphSeeded.mockResolvedValueOnce(false)
    mockSeedKnowledgeGraph.mockResolvedValueOnce({ created: 42 })

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: JSON.stringify({ action: 'seed' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.created).toBe(42)
  })

  it('skips seed if already seeded without force', async () => {
    mockIsKnowledgeGraphSeeded.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: JSON.stringify({ action: 'seed' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.created).toBe(0)
    expect(json.data.message).toContain('already seeded')
  })

  it('re-seeds when force is true', async () => {
    mockIsKnowledgeGraphSeeded.mockResolvedValueOnce(true)
    mockSeedKnowledgeGraph.mockResolvedValueOnce({ created: 10 })

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: JSON.stringify({ action: 'seed', force: true }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.created).toBe(10)
  })

  it('initializes project knowledge states', async () => {
    mockInitializeProjectKnowledgeStates.mockResolvedValueOnce(15)

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: JSON.stringify({ action: 'initialize' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.initialized).toBe(15)
  })

  it('returns error for initialize with no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: JSON.stringify({ action: 'initialize' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error for invalid action', async () => {
    const req = new NextRequest('http://localhost/api/knowledge', {
      method: 'POST',
      body: JSON.stringify({ action: 'invalid' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
