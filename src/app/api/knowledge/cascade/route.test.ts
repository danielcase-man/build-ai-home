import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetCascadingRequirements } = vi.hoisted(() => ({
  mockGetCascadingRequirements: vi.fn(),
}))

vi.mock('@/lib/knowledge-graph', () => ({
  getCascadingRequirements: mockGetCascadingRequirements,
}))

import { POST } from './route'

describe('POST /api/knowledge/cascade', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns cascade requirements for an item', async () => {
    mockGetCascadingRequirements.mockResolvedValueOnce({
      item: { id: 'k-1', item_name: 'Light Fixture', trade: 'electrical', phase_number: 9 },
      prerequisites: [
        { id: 'k-0', item_name: 'Junction Box', trade: 'electrical', item_type: 'task' },
      ],
      downstream: [
        { id: 'k-2', item_name: 'Final Inspection', trade: 'electrical', item_type: 'inspection' },
      ],
      materials: [
        { name: 'Romex 14/2', quantity_formula: '1 per run', unit: 'roll', specs: 'NM-B', from_item: 'Junction Box' },
      ],
      inspections: [
        { id: 'k-3', item_name: 'Rough-In Inspection', code_references: ['NEC 314.16'] },
      ],
    })

    const req = new NextRequest('http://localhost/api/knowledge/cascade', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'k-1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.item.id).toBe('k-1')
    expect(json.data.prerequisites).toHaveLength(1)
    expect(json.data.prerequisites[0].item_name).toBe('Junction Box')
    expect(json.data.downstream).toHaveLength(1)
    expect(json.data.downstream[0].item_name).toBe('Final Inspection')
    expect(json.data.materials).toHaveLength(1)
    expect(json.data.inspections).toHaveLength(1)
    expect(json.data.inspections[0].code_references).toEqual(['NEC 314.16'])
  })

  it('returns validation error when missing itemId', async () => {
    const req = new NextRequest('http://localhost/api/knowledge/cascade', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns 500 when item not found', async () => {
    mockGetCascadingRequirements.mockRejectedValueOnce(
      new Error('Knowledge item not found: k-999')
    )

    const req = new NextRequest('http://localhost/api/knowledge/cascade', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'k-999' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
