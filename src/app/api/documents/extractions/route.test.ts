import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetProject,
  mockGetExtractions,
  mockGetRoomSchedule,
  mockGetFixtureSummary,
  mockMarkExtractionReviewed,
  mockCreateSelectionsFromTakeoff,
  mockCreateBudgetItemsFromTakeoff,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockGetExtractions: vi.fn(),
  mockGetRoomSchedule: vi.fn(),
  mockGetFixtureSummary: vi.fn(),
  mockMarkExtractionReviewed: vi.fn(),
  mockCreateSelectionsFromTakeoff: vi.fn(),
  mockCreateBudgetItemsFromTakeoff: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

vi.mock('@/lib/plan-takeoff-service', () => ({
  getExtractions: mockGetExtractions,
  getRoomSchedule: mockGetRoomSchedule,
  getFixtureSummary: mockGetFixtureSummary,
  markExtractionReviewed: mockMarkExtractionReviewed,
  createSelectionsFromTakeoff: mockCreateSelectionsFromTakeoff,
  createBudgetItemsFromTakeoff: mockCreateBudgetItemsFromTakeoff,
}))

import { GET, PUT } from './route'

describe('GET /api/documents/extractions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('returns extractions list', async () => {
    const extractions = [
      {
        id: 'ext-1',
        document_id: 'doc-1',
        extraction_type: 'room_schedule',
        extracted_data: { rooms: ['Kitchen', 'Bath'] },
        confidence: 0.95,
        ai_notes: 'High confidence extraction',
        reviewed: false,
      },
    ]
    mockGetExtractions.mockResolvedValueOnce(extractions)

    const req = new NextRequest('http://localhost/api/documents/extractions')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(1)
    expect(json.data.extractions[0].id).toBe('ext-1')
    expect(json.data.extractions[0].extraction_type).toBe('room_schedule')
    expect(mockGetExtractions).toHaveBeenCalledWith('proj-1', {
      documentId: undefined,
      type: undefined,
    })
  })

  it('filters by document_id and type', async () => {
    mockGetExtractions.mockResolvedValueOnce([])

    const req = new NextRequest(
      'http://localhost/api/documents/extractions?document_id=doc-2&type=fixture_count'
    )
    await GET(req)

    expect(mockGetExtractions).toHaveBeenCalledWith('proj-1', {
      documentId: 'doc-2',
      type: 'fixture_count',
    })
  })

  it('returns room schedule when view=rooms', async () => {
    const rooms = [
      { name: 'Kitchen', floor: '1st', square_footage: 200 },
      { name: 'Master Bath', floor: '2nd', square_footage: 150 },
    ]
    mockGetRoomSchedule.mockResolvedValueOnce(rooms)

    const req = new NextRequest('http://localhost/api/documents/extractions?view=rooms')
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.rooms).toEqual(rooms)
    expect(mockGetRoomSchedule).toHaveBeenCalledWith('proj-1')
  })

  it('returns fixture summary when view=fixtures', async () => {
    const fixtures = { totalFixtures: 42, byType: { sink: 8, toilet: 5 } }
    mockGetFixtureSummary.mockResolvedValueOnce(fixtures)

    const req = new NextRequest('http://localhost/api/documents/extractions?view=fixtures')
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.totalFixtures).toBe(42)
    expect(mockGetFixtureSummary).toHaveBeenCalledWith('proj-1')
  })

  it('returns empty when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/documents/extractions')
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.extractions).toEqual([])
    expect(json.data.rooms).toEqual([])
  })

  it('returns error when service throws', async () => {
    mockGetExtractions.mockRejectedValueOnce(new Error('DB error'))

    const req = new NextRequest('http://localhost/api/documents/extractions')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('PUT /api/documents/extractions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('marks extraction as reviewed', async () => {
    mockMarkExtractionReviewed.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/documents/extractions', {
      method: 'PUT',
      body: JSON.stringify({ action: 'review', extraction_id: 'ext-1' }),
    })
    const res = await PUT(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
    expect(mockMarkExtractionReviewed).toHaveBeenCalledWith('ext-1')
  })

  it('returns validation error when review missing extraction_id', async () => {
    const req = new NextRequest('http://localhost/api/documents/extractions', {
      method: 'PUT',
      body: JSON.stringify({ action: 'review' }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Missing extraction_id')
  })

  it('creates selections from takeoff', async () => {
    const result = { created: 5, skipped: 2 }
    mockCreateSelectionsFromTakeoff.mockResolvedValueOnce(result)

    const req = new NextRequest('http://localhost/api/documents/extractions', {
      method: 'PUT',
      body: JSON.stringify({ action: 'create_selections', extraction_id: 'ext-1' }),
    })
    const res = await PUT(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(result)
    expect(mockCreateSelectionsFromTakeoff).toHaveBeenCalledWith('proj-1', 'ext-1')
  })

  it('creates budget items from takeoff', async () => {
    const result = { created: 3 }
    mockCreateBudgetItemsFromTakeoff.mockResolvedValueOnce(result)

    const req = new NextRequest('http://localhost/api/documents/extractions', {
      method: 'PUT',
      body: JSON.stringify({ action: 'create_budget_items', extraction_id: 'ext-1' }),
    })
    const res = await PUT(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(result)
    expect(mockCreateBudgetItemsFromTakeoff).toHaveBeenCalledWith('proj-1', 'ext-1')
  })

  it('returns validation error for invalid action', async () => {
    const req = new NextRequest('http://localhost/api/documents/extractions', {
      method: 'PUT',
      body: JSON.stringify({ action: 'invalid_action' }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Invalid action')
  })

  it('returns error when no project for create_selections', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/documents/extractions', {
      method: 'PUT',
      body: JSON.stringify({ action: 'create_selections', extraction_id: 'ext-1' }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns validation error when create_selections missing extraction_id', async () => {
    const req = new NextRequest('http://localhost/api/documents/extractions', {
      method: 'PUT',
      body: JSON.stringify({ action: 'create_selections' }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Missing extraction_id')
  })
})
