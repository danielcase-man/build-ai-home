import { describe, it, expect, vi } from 'vitest'

vi.mock('crypto', () => ({
  default: { randomBytes: vi.fn().mockReturnValue({ toString: () => 'mock-state-token' }) },
}))

vi.mock('@/lib/gmail', () => ({
  GmailService: vi.fn().mockImplementation(function(this: any) {
    this.getAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/auth?state=mock-state-token')
  }),
}))

vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual('@/lib/api-utils')
  return actual
})

import { GET } from './route'

describe('GET /api/gmail/auth', () => {
  it('returns auth URL with CSRF state token', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.authUrl).toContain('accounts.google.com')
    expect(json.data.state).toBeDefined()
  })
})
