import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockClearEmailAccountTokens } = vi.hoisted(() => ({
  mockClearEmailAccountTokens: vi.fn(),
}))

vi.mock('@/lib/database', () => ({
  db: { clearEmailAccountTokens: mockClearEmailAccountTokens },
}))

vi.mock('@/lib/env', () => ({
  env: { gmailUserEmail: 'test@gmail.com' },
}))

import { POST } from './route'

describe('POST /api/gmail/disconnect', () => {
  beforeEach(() => vi.clearAllMocks())

  it('disconnects Gmail account successfully', async () => {
    mockClearEmailAccountTokens.mockResolvedValueOnce(true)

    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.disconnected).toBe(true)
    expect(mockClearEmailAccountTokens).toHaveBeenCalledWith('test@gmail.com')
  })

  it('returns error when clearing tokens fails', async () => {
    mockClearEmailAccountTokens.mockResolvedValueOnce(false)

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when GMAIL_USER_EMAIL not configured', async () => {
    const envMod = await import('@/lib/env')
    Object.defineProperty(envMod.env, 'gmailUserEmail', { get: () => '', configurable: true })

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)

    Object.defineProperty(envMod.env, 'gmailUserEmail', { get: () => 'test@gmail.com', configurable: true })
  })

  it('returns error when clearEmailAccountTokens throws', async () => {
    mockClearEmailAccountTokens.mockRejectedValueOnce(new Error('DB error'))

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
