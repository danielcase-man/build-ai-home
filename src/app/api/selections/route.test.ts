import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUpdateSelection } = vi.hoisted(() => ({
  mockUpdateSelection: vi.fn(),
}))

vi.mock('@/lib/selections-service', () => ({
  updateSelection: mockUpdateSelection,
}))

import { PATCH } from './route'

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
    const updated = { id: 'sel-1', status: 'selected' }
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
