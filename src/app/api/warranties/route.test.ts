import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetWarranties,
  mockGetExpiringWarranties,
  mockCreateWarranty,
  mockGetCompliance,
  mockGetComplianceGaps,
  mockCreateCompliance,
  mockVerifyCompliance,
} = vi.hoisted(() => ({
  mockGetWarranties: vi.fn(),
  mockGetExpiringWarranties: vi.fn(),
  mockCreateWarranty: vi.fn(),
  mockGetCompliance: vi.fn(),
  mockGetComplianceGaps: vi.fn(),
  mockCreateCompliance: vi.fn(),
  mockVerifyCompliance: vi.fn(),
}))

vi.mock('@/lib/warranty-service', () => ({
  getWarranties: mockGetWarranties,
  getExpiringWarranties: mockGetExpiringWarranties,
  createWarranty: mockCreateWarranty,
  getCompliance: mockGetCompliance,
  getComplianceGaps: mockGetComplianceGaps,
  createCompliance: mockCreateCompliance,
  verifyCompliance: mockVerifyCompliance,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST, PATCH } from './route'

describe('GET /api/warranties', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns warranties', async () => {
    const warranties = [
      { id: 'w-1', category: 'Roofing', warranty_type: 'manufacturer', status: 'active' },
      { id: 'w-2', category: 'HVAC', warranty_type: 'labor', status: 'active' },
    ]
    mockGetWarranties.mockResolvedValueOnce(warranties)

    const req = new NextRequest('http://localhost/api/warranties')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.warranties).toEqual(warranties)
  })

  it('returns expiring warranties when view=expiring', async () => {
    const expiring = [
      { id: 'w-3', category: 'Plumbing', end_date: '2026-06-01' },
    ]
    mockGetExpiringWarranties.mockResolvedValueOnce(expiring)

    const req = new NextRequest('http://localhost/api/warranties?view=expiring')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(1)
    expect(json.data.warranties).toEqual(expiring)
  })

  it('returns compliance records when view=compliance', async () => {
    const compliance = [
      { id: 'c-1', insurance_type: 'general_liability', verified: true },
    ]
    mockGetCompliance.mockResolvedValueOnce(compliance)

    const req = new NextRequest('http://localhost/api/warranties?view=compliance')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(1)
    expect(json.data.compliance).toEqual(compliance)
  })

  it('returns compliance gaps when view=compliance_gaps', async () => {
    const gaps = { missing: ['workers_comp'], expired: ['auto_liability'] }
    mockGetComplianceGaps.mockResolvedValueOnce(gaps)

    const req = new NextRequest('http://localhost/api/warranties?view=compliance_gaps')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(gaps)
  })
})

describe('POST /api/warranties', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when missing required warranty fields', async () => {
    const req = new NextRequest('http://localhost/api/warranties', {
      method: 'POST',
      body: JSON.stringify({ category: 'Roofing' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('creates warranty', async () => {
    const created = {
      id: 'w-new',
      category: 'Roofing',
      warranty_type: 'manufacturer',
      start_date: '2026-01-01',
      end_date: '2036-01-01',
      status: 'active',
    }
    mockCreateWarranty.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/warranties', {
      method: 'POST',
      body: JSON.stringify({
        category: 'Roofing',
        warranty_type: 'manufacturer',
        start_date: '2026-01-01',
        end_date: '2036-01-01',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.warranty).toEqual(created)
  })

  it('creates compliance record when type=compliance', async () => {
    const record = {
      id: 'c-new',
      insurance_type: 'general_liability',
      effective_date: '2026-01-01',
      expiration_date: '2027-01-01',
      verified: false,
    }
    mockCreateCompliance.mockResolvedValueOnce(record)

    const req = new NextRequest('http://localhost/api/warranties', {
      method: 'POST',
      body: JSON.stringify({
        type: 'compliance',
        insurance_type: 'general_liability',
        effective_date: '2026-01-01',
        expiration_date: '2027-01-01',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.compliance).toEqual(record)
  })

  it('returns validation error for compliance missing required fields', async () => {
    const req = new NextRequest('http://localhost/api/warranties', {
      method: 'POST',
      body: JSON.stringify({
        type: 'compliance',
        insurance_type: 'general_liability',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})

describe('PATCH /api/warranties', () => {
  beforeEach(() => vi.clearAllMocks())

  it('verifies compliance with action=verify_compliance', async () => {
    mockVerifyCompliance.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/warranties', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'verify_compliance', id: 'c-1' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
    expect(mockVerifyCompliance).toHaveBeenCalledWith('c-1')
  })

  it('returns validation error for invalid action', async () => {
    const req = new NextRequest('http://localhost/api/warranties', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'unknown', id: 'c-1' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})
