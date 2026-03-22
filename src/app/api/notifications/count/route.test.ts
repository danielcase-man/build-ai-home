import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUnreadCount } = vi.hoisted(() => ({
  mockGetUnreadCount: vi.fn(),
}))

vi.mock('@/lib/notification-service', () => ({
  getUnreadCount: mockGetUnreadCount,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET } from './route'

describe('GET /api/notifications/count', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns unread count', async () => {
    mockGetUnreadCount.mockResolvedValueOnce(5)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.unreadCount).toBe(5)
    expect(mockGetUnreadCount).toHaveBeenCalledWith('proj-1')
  })

  it('returns zero when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.unreadCount).toBe(0)
  })

  it('returns zero when count is 0', async () => {
    mockGetUnreadCount.mockResolvedValueOnce(0)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.unreadCount).toBe(0)
  })
})
