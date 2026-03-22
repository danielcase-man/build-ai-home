import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetInspections, mockScheduleInspection, mockRecordInspectionResult, mockCreateFromInspection } = vi.hoisted(() => ({
  mockGetInspections: vi.fn(),
  mockScheduleInspection: vi.fn(),
  mockRecordInspectionResult: vi.fn(),
  mockCreateFromInspection: vi.fn(),
}))

vi.mock('@/lib/punch-list-service', () => ({
  getInspections: mockGetInspections,
  scheduleInspection: mockScheduleInspection,
  recordInspectionResult: mockRecordInspectionResult,
  createFromInspection: mockCreateFromInspection,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST, PATCH } from './route'

describe('GET /api/inspections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns inspections list', async () => {
    const inspections = [
      { id: 'ins-1', inspection_type: 'foundation', status: 'passed' },
      { id: 'ins-2', inspection_type: 'framing', status: 'scheduled' },
    ]
    mockGetInspections.mockResolvedValueOnce(inspections)

    const req = new NextRequest('http://localhost/api/inspections')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.inspections).toEqual(inspections)
  })

  it('filters by status query param', async () => {
    mockGetInspections.mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost/api/inspections?status=scheduled')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockGetInspections).toHaveBeenCalledWith('proj-1', { status: 'scheduled' })
  })

  it('returns empty when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/inspections')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.inspections).toEqual([])
  })
})

describe('POST /api/inspections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing inspection_type', async () => {
    const req = new NextRequest('http://localhost/api/inspections', {
      method: 'POST',
      body: JSON.stringify({ scheduled_date: '2026-04-01' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('schedules an inspection', async () => {
    const created = {
      id: 'ins-new',
      inspection_type: 'plumbing_rough',
      status: 'scheduled',
      scheduled_date: '2026-04-15',
    }
    mockScheduleInspection.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/inspections', {
      method: 'POST',
      body: JSON.stringify({
        inspection_type: 'plumbing_rough',
        scheduled_date: '2026-04-15',
        inspector_name: 'John Smith',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.inspection).toEqual(created)
  })

  it('returns error when schedule fails', async () => {
    mockScheduleInspection.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/inspections', {
      method: 'POST',
      body: JSON.stringify({ inspection_type: 'electrical' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('PATCH /api/inspections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing id', async () => {
    const req = new NextRequest('http://localhost/api/inspections', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'record_result', status: 'passed' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns validation error for invalid action', async () => {
    const req = new NextRequest('http://localhost/api/inspections', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'ins-1', action: 'bogus' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('records a passed inspection result', async () => {
    mockRecordInspectionResult.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/inspections', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'ins-1',
        action: 'record_result',
        status: 'passed',
        inspector_name: 'Bob',
        notes: 'All good',
      }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
  })

  it('creates punch items from failed inspection deficiencies', async () => {
    mockRecordInspectionResult.mockResolvedValueOnce(true)
    mockCreateFromInspection.mockResolvedValueOnce(undefined)

    const deficiencies = ['Exposed wire', 'Missing outlet cover']
    const req = new NextRequest('http://localhost/api/inspections', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'ins-2',
        action: 'record_result',
        status: 'failed',
        deficiencies,
      }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(mockCreateFromInspection).toHaveBeenCalledWith('proj-1', 'ins-2', deficiencies)
  })
})
