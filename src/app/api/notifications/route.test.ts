import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetNotifications, mockMarkAsRead, mockMarkAllAsRead } = vi.hoisted(() => ({
  mockGetNotifications: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockMarkAllAsRead: vi.fn(),
}))

vi.mock('@/lib/notification-service', () => ({
  getNotifications: mockGetNotifications,
  markAsRead: mockMarkAsRead,
  markAllAsRead: mockMarkAllAsRead,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, PATCH } from './route'

describe('GET /api/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns notifications list', async () => {
    const notifications = [
      { id: 'n-1', type: 'email_sync', message: 'New emails synced', read: false },
      { id: 'n-2', type: 'deadline', message: 'Task due tomorrow', read: true },
    ]
    mockGetNotifications.mockResolvedValueOnce(notifications)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.notifications).toEqual(notifications)
  })

  it('returns empty when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.notifications).toEqual([])
    expect(json.data.unreadCount).toBe(0)
  })
})

describe('PATCH /api/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks a single notification as read', async () => {
    mockMarkAsRead.mockResolvedValueOnce(undefined)

    const req = new NextRequest('http://localhost/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationId: 'n-1' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockMarkAsRead).toHaveBeenCalledWith('n-1')
  })

  it('marks all notifications as read', async () => {
    mockMarkAllAsRead.mockResolvedValueOnce(undefined)

    const req = new NextRequest('http://localhost/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ markAllRead: true }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockMarkAllAsRead).toHaveBeenCalledWith('proj-1')
  })

  it('returns error when neither notificationId nor markAllRead provided', async () => {
    const req = new NextRequest('http://localhost/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when no project found', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationId: 'n-1' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
