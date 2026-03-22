import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockExchangePublicToken,
  mockGetAccounts,
  mockUpsertPlaidConnection,
  mockEncryptTokens,
  mockGetProject,
} = vi.hoisted(() => ({
  mockExchangePublicToken: vi.fn(),
  mockGetAccounts: vi.fn(),
  mockUpsertPlaidConnection: vi.fn(),
  mockEncryptTokens: vi.fn(),
  mockGetProject: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/plaid-client', () => ({
  exchangePublicToken: mockExchangePublicToken,
  getAccounts: mockGetAccounts,
}))

vi.mock('@/lib/financial-service', () => ({
  upsertPlaidConnection: mockUpsertPlaidConnection,
}))

vi.mock('@/lib/token-encryption', () => ({
  encryptTokens: mockEncryptTokens,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

import { POST } from './route'

describe('POST /api/plaid/exchange-token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockExchangePublicToken.mockResolvedValue({
      accessToken: 'access-sandbox-xyz',
      itemId: 'item-abc',
    })
    mockGetAccounts.mockResolvedValue([
      { account_id: 'acct-1', name: 'Checking', mask: '1234', type: 'depository', subtype: 'checking' },
    ])
    mockEncryptTokens.mockReturnValue({ iv: 'iv', data: 'enc', tag: 'tag' })
    mockUpsertPlaidConnection.mockResolvedValue({ id: 'conn-1', status: 'active' })
  })

  it('exchanges public token and saves connection', async () => {
    const req = new NextRequest('http://localhost/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({
        public_token: 'public-sandbox-123',
        institution_id: 'ins_1',
        institution_name: 'Chase',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.connection).toEqual({ id: 'conn-1', status: 'active' })
    expect(mockExchangePublicToken).toHaveBeenCalledWith('public-sandbox-123')
    expect(mockGetAccounts).toHaveBeenCalledWith('access-sandbox-xyz')
    expect(mockUpsertPlaidConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        institution_name: 'Chase',
        item_id: 'item-abc',
        status: 'active',
      })
    )
  })

  it('returns validation error when public_token missing', async () => {
    const req = new NextRequest('http://localhost/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ institution_name: 'Chase' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ public_token: 'public-sandbox-123' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('defaults institution_name to Unknown Bank', async () => {
    const req = new NextRequest('http://localhost/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ public_token: 'public-sandbox-123' }),
    })

    await POST(req)
    expect(mockUpsertPlaidConnection).toHaveBeenCalledWith(
      expect.objectContaining({ institution_name: 'Unknown Bank' })
    )
  })
})
