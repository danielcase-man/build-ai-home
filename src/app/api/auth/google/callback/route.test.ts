import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetTokens, mockUpsertEmailAccount, mockEncryptTokens } = vi.hoisted(() => ({
  mockGetTokens: vi.fn().mockResolvedValue({ access_token: 'at', refresh_token: 'rt' }),
  mockUpsertEmailAccount: vi.fn().mockResolvedValue({}),
  mockEncryptTokens: vi.fn().mockReturnValue({ _encrypted: true, iv: 'x', data: 'y', tag: 'z' }),
}))

vi.mock('@/lib/gmail', () => ({
  GmailService: vi.fn().mockImplementation(function(this: any) {
    this.getTokens = mockGetTokens
  }),
}))

vi.mock('@/lib/database', () => ({
  db: { upsertEmailAccount: mockUpsertEmailAccount },
}))

vi.mock('@/lib/env', () => ({
  env: { gmailUserEmail: 'test@gmail.com' },
}))

vi.mock('@/lib/token-encryption', () => ({
  encryptTokens: mockEncryptTokens,
}))

import { GET } from './route'
import { NextRequest } from 'next/server'

describe('GET /api/auth/google/callback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects with success on valid code', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/google/callback?code=test-code')
    const res = await GET(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('success=connected')
    expect(mockGetTokens).toHaveBeenCalledWith('test-code')
    expect(mockEncryptTokens).toHaveBeenCalled()
    expect(mockUpsertEmailAccount).toHaveBeenCalled()
  })

  it('redirects with error when no code', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/google/callback')
    const res = await GET(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('error=no_code')
  })

  it('redirects with error on token exchange failure', async () => {
    mockGetTokens.mockRejectedValueOnce(new Error('invalid code'))
    const req = new NextRequest('http://localhost:3000/api/auth/google/callback?code=bad')
    const res = await GET(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('error=auth_failed')
  })
})
