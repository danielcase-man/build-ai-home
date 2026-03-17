import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUpdateSelection, mockCreateSelection } = vi.hoisted(() => ({
  mockUpdateSelection: vi.fn(),
  mockCreateSelection: vi.fn(),
}))

vi.mock('@/lib/selections-service', () => ({
  updateSelection: mockUpdateSelection,
  createSelection: mockCreateSelection,
}))

vi.mock('@/lib/workflow-service', () => ({
  checkAndCompleteSelectionDecisions: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/category-mapping', () => ({
  resolveKnowledgeIdForSelection: vi.fn().mockResolvedValue('knowledge-1'),
  getPhaseForSelectionCategory: vi.fn().mockReturnValue(7),
}))

vi.mock('@/lib/lead-time-utils', () => ({
  parseLeadTimeDays: vi.fn().mockReturnValue(56),
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { POST, PATCH } from './route'

describe('POST /api/selections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing required fields', async () => {
    const req = new Request('http://localhost:3000/api/selections', {
      method: 'POST',
      body: JSON.stringify({ room: 'Kitchen' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates selection with auto-resolved knowledge_id', async () => {
    const created = {
      id: 'sel-new',
      room: 'Kitchen',
      category: 'plumbing',
      product_name: 'Delta Faucet',
      quantity: 1,
      status: 'considering',
      knowledge_id: 'knowledge-1',
      needed_by_phase: 7,
    }
    mockCreateSelection.mockResolvedValueOnce(created)

    const req = new Request('http://localhost:3000/api/selections', {
      method: 'POST',
      body: JSON.stringify({
        room: 'Kitchen',
        category: 'plumbing',
        product_name: 'Delta Faucet',
        lead_time: '6-8 weeks',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('sel-new')
  })
})

describe('PATCH /api/selections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when no id', async () => {
    const req = new Request('http://localhost:3000/api/selections', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'selected' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('updates selection successfully', async () => {
    const updated = { id: 'sel-1', status: 'selected', category: 'plumbing' }
    mockUpdateSelection.mockResolvedValueOnce(updated)

    const req = new Request('http://localhost:3000/api/selections', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'sel-1', status: 'selected' }),
    })
    const res = await PATCH(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('selected')
  })

  it('returns error when selection not found', async () => {
    mockUpdateSelection.mockResolvedValueOnce(null)

    const req = new Request('http://localhost:3000/api/selections', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'sel-999', status: 'selected' }),
    })
    const res = await PATCH(req)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
