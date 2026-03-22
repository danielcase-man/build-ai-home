import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPushItem, mockGetLocalPushableItems, mockGetProject } = vi.hoisted(() => ({
  mockPushItem: vi.fn(),
  mockGetLocalPushableItems: vi.fn(),
  mockGetProject: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/env', () => ({
  env: { jobtreadApiKey: 'jt-key-123' },
}))

vi.mock('@/lib/jobtread-push', () => ({
  pushItem: mockPushItem,
  getLocalPushableItems: mockGetLocalPushableItems,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

import { GET, POST } from './route'

describe('GET /api/jobtread/push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('returns pushable items', async () => {
    const items = [
      { type: 'create_task', label: 'New Task', data: { name: 'Test' } },
    ]
    mockGetLocalPushableItems.mockResolvedValueOnce(items)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.items).toEqual(items)
    expect(mockGetLocalPushableItems).toHaveBeenCalledWith('proj-1')
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns empty items when JobTread not configured', async () => {
    const envMod = await import('@/lib/env')
    Object.defineProperty(envMod.env, 'jobtreadApiKey', { get: () => undefined, configurable: true })

    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.items).toEqual([])
    expect(json.data.message).toBe('JobTread not configured')

    Object.defineProperty(envMod.env, 'jobtreadApiKey', { get: () => 'jt-key-123', configurable: true })
  })
})

describe('POST /api/jobtread/push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('pushes an item successfully', async () => {
    mockPushItem.mockResolvedValueOnce({
      success: true,
      type: 'create_task',
      label: 'New Task',
      jobtreadId: 'jt-123',
    })

    const req = new NextRequest('http://localhost/api/jobtread/push', {
      method: 'POST',
      body: JSON.stringify({
        type: 'create_task',
        label: 'New Task',
        data: { name: 'Foundation inspection' },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.jobtreadId).toBe('jt-123')
  })

  it('returns error when push fails', async () => {
    mockPushItem.mockResolvedValueOnce({
      success: false,
      type: 'create_task',
      label: 'New Task',
      error: 'API rejected request',
    })

    const req = new NextRequest('http://localhost/api/jobtread/push', {
      method: 'POST',
      body: JSON.stringify({
        type: 'create_task',
        label: 'New Task',
        data: {},
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when missing required fields', async () => {
    const req = new NextRequest('http://localhost/api/jobtread/push', {
      method: 'POST',
      body: JSON.stringify({ data: {} }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when JobTread not configured', async () => {
    const envMod = await import('@/lib/env')
    Object.defineProperty(envMod.env, 'jobtreadApiKey', { get: () => undefined, configurable: true })

    const req = new NextRequest('http://localhost/api/jobtread/push', {
      method: 'POST',
      body: JSON.stringify({ type: 'create_task', label: 'Test', data: {} }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)

    Object.defineProperty(envMod.env, 'jobtreadApiKey', { get: () => 'jt-key-123', configurable: true })
  })
})
