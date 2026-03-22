import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetVendorThreads,
  mockGetThreadTimeline,
  mockGetFollowUpsNeeded,
  mockAutoLinkEmails,
  mockCreateVendorThread,
  mockUpdateVendorThread,
  mockMarkBidReceived,
} = vi.hoisted(() => ({
  mockGetVendorThreads: vi.fn(),
  mockGetThreadTimeline: vi.fn(),
  mockGetFollowUpsNeeded: vi.fn(),
  mockAutoLinkEmails: vi.fn(),
  mockCreateVendorThread: vi.fn(),
  mockUpdateVendorThread: vi.fn(),
  mockMarkBidReceived: vi.fn(),
}))

vi.mock('@/lib/vendor-thread-service', () => ({
  getVendorThreads: mockGetVendorThreads,
  getThreadTimeline: mockGetThreadTimeline,
  getFollowUpsNeeded: mockGetFollowUpsNeeded,
  autoLinkEmails: mockAutoLinkEmails,
  createVendorThread: mockCreateVendorThread,
  updateVendorThread: mockUpdateVendorThread,
  markBidReceived: mockMarkBidReceived,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST, PATCH } from './route'

describe('GET /api/vendor-threads', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all threads when no filters', async () => {
    const threads = [
      {
        id: 'vt-1',
        vendor_name: 'Acme Plumbing',
        vendor_email: 'acme@test.com',
        category: 'plumbing',
        status: 'active',
        days_since_contact: 3,
        follow_up_date: null,
        bid_requested_date: '2026-01-10',
        bid_received_date: null,
        last_activity: '2026-03-19',
        notes: null,
      },
    ]
    mockGetVendorThreads.mockResolvedValueOnce(threads)

    const req = new NextRequest('http://localhost/api/vendor-threads')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(1)
    expect(json.data.threads[0].vendor_name).toBe('Acme Plumbing')
  })

  it('returns single thread timeline when id provided', async () => {
    const thread = { id: 'vt-1', vendor_name: 'Acme Plumbing' }
    const timeline = [{ type: 'email', date: '2026-03-18' }]
    mockGetThreadTimeline.mockResolvedValueOnce({ thread, timeline })

    const req = new NextRequest('http://localhost/api/vendor-threads?id=vt-1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.thread).toEqual(thread)
    expect(json.data.timeline).toEqual(timeline)
  })

  it('returns follow-ups when view=follow_ups', async () => {
    const followUps = [
      {
        thread: {
          id: 'vt-2',
          vendor_name: 'Best Electric',
          vendor_email: 'best@test.com',
          category: 'electrical',
        },
        days_waiting: 7,
        reason: 'No response to bid request',
      },
    ]
    mockGetFollowUpsNeeded.mockResolvedValueOnce(followUps)

    const req = new NextRequest('http://localhost/api/vendor-threads?view=follow_ups&threshold=3')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(1)
    expect(json.data.follow_ups[0].vendor_name).toBe('Best Electric')
    expect(json.data.follow_ups[0].days_waiting).toBe(7)
  })

  it('filters threads by status and category', async () => {
    mockGetVendorThreads.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/vendor-threads?status=active&category=plumbing')
    await GET(req)
    expect(mockGetVendorThreads).toHaveBeenCalledWith('proj-1', { status: 'active', category: 'plumbing' })
  })
})

describe('POST /api/vendor-threads', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing vendor_name', async () => {
    const req = new NextRequest('http://localhost/api/vendor-threads', {
      method: 'POST',
      body: JSON.stringify({ vendor_email: 'test@test.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('creates vendor thread', async () => {
    const created = {
      id: 'vt-new',
      vendor_name: 'New Vendor',
      status: 'active',
    }
    mockCreateVendorThread.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/vendor-threads', {
      method: 'POST',
      body: JSON.stringify({
        vendor_name: 'New Vendor',
        vendor_email: 'new@test.com',
        category: 'framing',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.thread).toEqual(created)
  })

  it('triggers auto_link action', async () => {
    const result = { linked: 5, threads_updated: 3 }
    mockAutoLinkEmails.mockResolvedValueOnce(result)

    const req = new NextRequest('http://localhost/api/vendor-threads', {
      method: 'POST',
      body: JSON.stringify({ action: 'auto_link' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.linked).toBe(5)
  })

  it('returns error when insert fails', async () => {
    mockCreateVendorThread.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/vendor-threads', {
      method: 'POST',
      body: JSON.stringify({ vendor_name: 'Fail Vendor' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('PATCH /api/vendor-threads', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing thread_id', async () => {
    const req = new NextRequest('http://localhost/api/vendor-threads', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'closed' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('updates vendor thread', async () => {
    mockUpdateVendorThread.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/vendor-threads', {
      method: 'PATCH',
      body: JSON.stringify({ thread_id: 'vt-1', status: 'closed', notes: 'Done' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
  })

  it('marks bid received', async () => {
    mockMarkBidReceived.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/vendor-threads', {
      method: 'PATCH',
      body: JSON.stringify({ thread_id: 'vt-1', action: 'mark_bid_received', received_date: '2026-03-20' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
    expect(mockMarkBidReceived).toHaveBeenCalledWith('vt-1', '2026-03-20')
  })
})
