import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetContracts, mockUpsertContract } = vi.hoisted(() => ({
  mockGetContracts: vi.fn(),
  mockUpsertContract: vi.fn(),
}))

vi.mock('@/lib/financial-service', () => ({
  getContracts: mockGetContracts,
  upsertContract: mockUpsertContract,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST } from './route'

describe('GET /api/contracts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns contracts', async () => {
    const contracts = [
      { id: 'c-1', title: 'Framing Contract', total_amount: 45000, status: 'signed' },
      { id: 'c-2', title: 'Plumbing Contract', total_amount: 28000, status: 'draft' },
    ]
    mockGetContracts.mockResolvedValueOnce(contracts)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.contracts).toEqual(contracts)
  })

  it('returns error when no project found', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('POST /api/contracts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing title', async () => {
    const req = new NextRequest('http://localhost/api/contracts', {
      method: 'POST',
      body: JSON.stringify({ total_amount: 50000 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns validation error when missing total_amount', async () => {
    const req = new NextRequest('http://localhost/api/contracts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Roofing Contract' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('creates contract', async () => {
    const created = {
      id: 'c-new',
      title: 'Electrical Contract',
      total_amount: 35000,
      status: 'draft',
    }
    mockUpsertContract.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/contracts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Electrical Contract',
        total_amount: 35000,
        vendor_id: 'v-1',
        description: 'Full electrical rough-in and finish',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.contract).toEqual(created)
  })

  it('accepts total_amount of zero', async () => {
    const created = { id: 'c-zero', title: 'Warranty only', total_amount: 0, status: 'draft' }
    mockUpsertContract.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/contracts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Warranty only', total_amount: 0 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.contract).toEqual(created)
  })
})
