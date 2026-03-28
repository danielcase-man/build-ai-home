import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetPhotoTimeline,
  mockGetPhotosByRoom,
  mockGetPhotoCount,
  mockUploadPhoto,
  mockAnalyzePhoto,
} = vi.hoisted(() => ({
  mockGetPhotoTimeline: vi.fn(),
  mockGetPhotosByRoom: vi.fn(),
  mockGetPhotoCount: vi.fn(),
  mockUploadPhoto: vi.fn(),
  mockAnalyzePhoto: vi.fn(),
}))

vi.mock('@/lib/photo-service', () => ({
  getPhotoTimeline: mockGetPhotoTimeline,
  getPhotosByRoom: mockGetPhotosByRoom,
  getPhotoCount: mockGetPhotoCount,
  uploadPhoto: mockUploadPhoto,
  analyzePhoto: mockAnalyzePhoto,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST } from './route'

describe('GET /api/photos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns photo timeline', async () => {
    const photos = [
      { id: 'p-1', filename: 'foundation.jpg', phase_number: 5 },
      { id: 'p-2', filename: 'framing.jpg', phase_number: 7 },
    ]
    mockGetPhotoTimeline.mockResolvedValueOnce(photos)

    const req = new NextRequest('http://localhost/api/photos')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.photos).toEqual(photos)
  })

  it('returns photos by room', async () => {
    const rooms = {
      Kitchen: [{ id: 'p-1', room: 'Kitchen' }],
      Bathroom: [{ id: 'p-2', room: 'Bathroom' }],
    }
    mockGetPhotosByRoom.mockResolvedValueOnce(rooms)

    const req = new NextRequest('http://localhost/api/photos?view=by_room')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.rooms).toEqual(rooms)
  })

  it('returns photo count', async () => {
    mockGetPhotoCount.mockResolvedValueOnce(42)

    const req = new NextRequest('http://localhost/api/photos?view=count')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(42)
  })

  it('filters by phase, room, and type', async () => {
    mockGetPhotoTimeline.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/photos?phase=7&room=Kitchen&type=progress')
    await GET(req)

    expect(mockGetPhotoTimeline).toHaveBeenCalledWith('proj-1', {
      phase: 7,
      room: 'Kitchen',
      type: 'progress',
    })
  })

  it('returns empty when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/photos')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.photos).toEqual([])
  })
})

describe('POST /api/photos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uploads a photo', async () => {
    const photo = { id: 'p-new', filename: 'test.jpg', photo_type: 'progress' }
    mockUploadPhoto.mockResolvedValueOnce(photo)

    const formData = new FormData()
    formData.append('photo', new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' }))
    formData.append('caption', 'Foundation pour')
    formData.append('type', 'progress')

    const req = new NextRequest('http://localhost/api/photos', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.photo).toEqual(photo)
  })

  it('returns validation error when no photo', async () => {
    const formData = new FormData()
    formData.append('caption', 'No photo')

    const req = new NextRequest('http://localhost/api/photos', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('uploads photo without AI analysis (Phase 2: deferred to Claude Code)', async () => {
    const photo = { id: 'p-new', filename: 'test.jpg' }
    mockUploadPhoto.mockResolvedValueOnce(photo)

    const formData = new FormData()
    formData.append('photo', new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' }))
    formData.append('analyze', 'true') // analyze flag is now ignored

    const req = new NextRequest('http://localhost/api/photos', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.photo).toEqual(photo) // no ai_description added inline
    expect(mockAnalyzePhoto).not.toHaveBeenCalled()
  })

  it('returns error when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const formData = new FormData()
    formData.append('photo', new File(['fake'], 'test.jpg', { type: 'image/jpeg' }))

    const req = new NextRequest('http://localhost/api/photos', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when upload fails', async () => {
    mockUploadPhoto.mockResolvedValueOnce(null)

    const formData = new FormData()
    formData.append('photo', new File(['fake'], 'test.jpg', { type: 'image/jpeg' }))

    const req = new NextRequest('http://localhost/api/photos', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
