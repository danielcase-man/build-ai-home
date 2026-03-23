import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetInvitationByToken, mockAcceptInvitation, mockFromResults } = vi.hoisted(() => {
  const mockFromResults: Record<string, { data: Record<string, unknown> | null; error: null }> = {}
  return {
    mockGetInvitationByToken: vi.fn(),
    mockAcceptInvitation: vi.fn(),
    mockFromResults,
  }
})

vi.mock('@/lib/vendor-invitation-service', () => ({
  getInvitationByToken: mockGetInvitationByToken,
  acceptInvitation: mockAcceptInvitation,
}))

vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    supabaseServiceRoleKey: undefined, // No service role → uses fallback signUp
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null }),
    },
    from: (table: string) => {
      const result = mockFromResults[table] || { data: null, error: null }
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: () => Promise.resolve(result),
      }
      return chain
    },
  },
}))

import { GET, POST } from './route'

describe('GET /api/vendors/invite/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromResults['vendors'] = { data: null, error: null }
    mockFromResults['projects'] = { data: null, error: null }
  })

  it('validates token and returns invitation with vendor/project info', async () => {
    mockGetInvitationByToken.mockResolvedValueOnce({
      id: 'inv-1',
      email: 'vendor@test.com',
      vendor_id: 'v-1',
      project_id: 'proj-1',
      expires_at: '2026-04-01',
      accepted_at: null,
    })
    mockFromResults['vendors'] = {
      data: { company_name: 'Delta Plumbing', category: 'plumbing' },
      error: null,
    }
    mockFromResults['projects'] = {
      data: { address: '708 Purple Salvia Cove', phase: 'construction' },
      error: null,
    }

    const req = new NextRequest('http://localhost/api/vendors/invite/accept?token=abc123')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.invitation.id).toBe('inv-1')
    expect(json.data.invitation.email).toBe('vendor@test.com')
    expect(json.data.vendor.company_name).toBe('Delta Plumbing')
    expect(json.data.project.address).toBe('708 Purple Salvia Cove')
  })

  it('returns validation error when token is missing', async () => {
    const req = new NextRequest('http://localhost/api/vendors/invite/accept')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns error when invitation not found or expired', async () => {
    mockGetInvitationByToken.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/vendors/invite/accept?token=expired123')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toContain('not found or expired')
  })

  it('returns null vendor/project when DB lookups miss', async () => {
    mockGetInvitationByToken.mockResolvedValueOnce({
      id: 'inv-1',
      email: 'vendor@test.com',
      vendor_id: 'v-1',
      project_id: 'proj-1',
      expires_at: '2026-04-01',
      accepted_at: null,
    })

    const req = new NextRequest('http://localhost/api/vendors/invite/accept?token=abc123')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.vendor).toBeNull()
    expect(json.data.project).toBeNull()
  })
})

describe('POST /api/vendors/invite/accept', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts invitation', async () => {
    mockGetInvitationByToken.mockResolvedValueOnce({
      id: 'inv-1',
      email: 'vendor@test.com',
      vendor_id: 'v-1',
      project_id: 'proj-1',
      expires_at: '2026-04-01',
      accepted_at: null,
    })
    mockAcceptInvitation.mockResolvedValueOnce(true)

    const req = new NextRequest('http://localhost/api/vendors/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc123', password: 'TestPass123!' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.accepted).toBe(true)
  })

  it('returns already_accepted for already accepted invitation', async () => {
    mockGetInvitationByToken.mockResolvedValueOnce({
      id: 'inv-1',
      email: 'vendor@test.com',
      vendor_id: 'v-1',
      project_id: 'proj-1',
      expires_at: '2026-04-01',
      accepted_at: '2026-03-20T10:00:00Z',
    })

    const req = new NextRequest('http://localhost/api/vendors/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc123', password: 'TestPass123!' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.already_accepted).toBe(true)
  })

  it('returns validation error when token is missing', async () => {
    const req = new NextRequest('http://localhost/api/vendors/invite/accept', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns error when invitation not found', async () => {
    mockGetInvitationByToken.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/vendors/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ token: 'badtoken', password: 'TestPass123!' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('still succeeds even if accept marking fails (user account was created)', async () => {
    mockGetInvitationByToken.mockResolvedValueOnce({
      id: 'inv-1',
      email: 'vendor@test.com',
      vendor_id: 'v-1',
      project_id: 'proj-1',
      expires_at: '2026-04-01',
      accepted_at: null,
    })
    mockAcceptInvitation.mockResolvedValueOnce(false)

    const req = new NextRequest('http://localhost/api/vendors/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ token: 'abc123', password: 'TestPass123!' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.accepted).toBe(true)
  })
})
