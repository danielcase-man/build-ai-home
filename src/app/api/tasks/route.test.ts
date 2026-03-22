import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockChain, mockResult } = vi.hoisted(() => {
  const mockResult = { current: { data: null as unknown, error: null as unknown } }
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = ['from', 'select', 'insert', 'update', 'eq', 'order', 'limit', 'single']
  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => chain)
  }
  chain.single = vi.fn().mockImplementation(() => Promise.resolve(mockResult.current))
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: (v: unknown) => void) => resolve(mockResult.current),
  })
  return { mockChain: chain, mockResult }
})

vi.mock('@/lib/supabase', () => ({
  supabase: mockChain,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, PATCH } from './route'

describe('GET /api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.current = { data: null, error: null }
  })

  it('returns tasks list', async () => {
    const tasks = [
      { id: 't-1', title: 'Review bid', status: 'pending' },
      { id: 't-2', title: 'Call inspector', status: 'completed' },
    ]
    mockResult.current = { data: tasks, error: null }

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.tasks).toEqual(tasks)
  })

  it('returns empty tasks when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.tasks).toEqual([])
  })
})

describe('PATCH /api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResult.current = { data: null, error: null }
  })

  it('returns validation error when missing task_id', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('updates task status successfully', async () => {
    const updated = { id: 't-1', title: 'Review bid', status: 'completed' }
    mockResult.current = { data: updated, error: null }

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ task_id: 't-1', status: 'completed' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.task).toEqual(updated)
  })

  it('appends resolution note to existing notes', async () => {
    // First call: select existing notes
    mockResult.current = { data: { notes: 'Original note' }, error: null }

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ task_id: 't-1', resolution_note: 'Fixed the issue' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('returns error when supabase update fails', async () => {
    mockResult.current = { data: null, error: { message: 'DB error' } }

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ task_id: 't-1', status: 'completed' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
