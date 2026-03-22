import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCreateVendorInvitation,
  mockGetVendorInvitations,
  mockRevokeInvitation,
} = vi.hoisted(() => ({
  mockCreateVendorInvitation: vi.fn(),
  mockGetVendorInvitations: vi.fn(),
  mockRevokeInvitation: vi.fn(),
}))

vi.mock('@/lib/vendor-invitation-service', () => ({
  createVendorInvitation: mockCreateVendorInvitation,
  getVendorInvitations: mockGetVendorInvitations,
  revokeInvitation: mockRevokeInvitation,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST, DELETE } from './route'

describe('GET /api/vendors/invite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns invitations', async () => {
    const invitations = [
      { id: 'inv-1', vendor_id: 'v-1', email: 'vendor1@test.com', status: 'pending' },
      { id: 'inv-2', vendor_id: 'v-2', email: 'vendor2@test.com', status: 'accepted' },
    ]
    mockGetVendorInvitations.mockResolvedValueOnce(invitations)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.invitations).toEqual(invitations)
  })

  it('returns empty array when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.invitations).toEqual([])
  })
})

describe('POST /api/vendors/invite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates invitation', async () => {
    const created = {
      id: 'inv-new',
      vendor_id: 'v-1',
      email: 'newvendor@test.com',
      status: 'pending',
    }
    mockCreateVendorInvitation.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/vendors/invite', {
      method: 'POST',
      body: JSON.stringify({ vendor_id: 'v-1', email: 'newvendor@test.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.invitation).toEqual(created)
    expect(mockCreateVendorInvitation).toHaveBeenCalledWith('proj-1', 'v-1', 'newvendor@test.com')
  })

  it('returns validation error when missing vendor_id', async () => {
    const req = new NextRequest('http://localhost/api/vendors/invite', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns validation error when missing email', async () => {
    const req = new NextRequest('http://localhost/api/vendors/invite', {
      method: 'POST',
      body: JSON.stringify({ vendor_id: 'v-1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('validates email format', async () => {
    const req = new NextRequest('http://localhost/api/vendors/invite', {
      method: 'POST',
      body: JSON.stringify({ vendor_id: 'v-1', email: 'not-an-email' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns error when insert fails', async () => {
    mockCreateVendorInvitation.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/vendors/invite', {
      method: 'POST',
      body: JSON.stringify({ vendor_id: 'v-1', email: 'fail@test.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})

describe('DELETE /api/vendors/invite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('revokes invitation', async () => {
    mockRevokeInvitation.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/vendors/invite', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'inv-1' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)
    expect(mockRevokeInvitation).toHaveBeenCalledWith('inv-1')
  })

  it('returns validation error when missing id', async () => {
    const req = new NextRequest('http://localhost/api/vendors/invite', {
      method: 'DELETE',
      body: JSON.stringify({}),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})
