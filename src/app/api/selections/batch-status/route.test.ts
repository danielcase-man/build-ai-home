import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetProject, mockCheckAndComplete, supabaseMock } = vi.hoisted(() => {
  const supabaseMock = {
    from: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    select: vi.fn(),
  }
  return {
    mockGetProject: vi.fn(),
    mockCheckAndComplete: vi.fn(),
    supabaseMock,
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }))
vi.mock('@/lib/project-service', () => ({ getProject: () => mockGetProject() }))
vi.mock('@/lib/workflow-service', () => ({
  checkAndCompleteSelectionDecisions: (...a: unknown[]) => mockCheckAndComplete(...a),
}))

import { PATCH } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://test/api/selections/batch-status', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/selections/batch-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockCheckAndComplete.mockResolvedValue(true)
    supabaseMock.from.mockReturnValue(supabaseMock)
    supabaseMock.update.mockReturnValue(supabaseMock)
    supabaseMock.eq.mockReturnValue(supabaseMock)
    supabaseMock.neq.mockReturnValue(supabaseMock)
    supabaseMock.select.mockResolvedValue({ data: [{ id: 's1' }, { id: 's2' }], error: null })
  })

  it('validates required fields', async () => {
    const res = await PATCH(makeRequest({ category: 'cabinetry' }))
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('required')
  })

  it('validates status value', async () => {
    const res = await PATCH(makeRequest({ category: 'cabinetry', newStatus: 'bogus' }))
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('Invalid status')
  })

  it('batch updates selections and returns count', async () => {
    const res = await PATCH(makeRequest({ category: 'cabinetry', newStatus: 'ordered' }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.updated).toBe(2)
    expect(supabaseMock.from).toHaveBeenCalledWith('selections')
  })

  it('triggers workflow check after update', async () => {
    await PATCH(makeRequest({ category: 'cabinetry', newStatus: 'ordered' }))
    expect(mockCheckAndComplete).toHaveBeenCalledWith('proj-1', 'cabinetry')
  })

  it('returns error when no project', async () => {
    mockGetProject.mockResolvedValue(null)
    const res = await PATCH(makeRequest({ category: 'cabinetry', newStatus: 'ordered' }))
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
