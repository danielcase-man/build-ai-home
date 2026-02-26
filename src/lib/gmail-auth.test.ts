import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pre-declare all mocks via vi.hoisted
const {
  mockGetEmailAccount,
  mockUpsertEmailAccount,
  mockSetCredentials,
  mockIsTokenExpired,
  mockRefreshAccessToken,
  mockEncryptTokens,
  mockDecryptTokens,
  mockIsEncryptedTokens,
} = vi.hoisted(() => ({
  mockGetEmailAccount: vi.fn(),
  mockUpsertEmailAccount: vi.fn(),
  mockSetCredentials: vi.fn(),
  mockIsTokenExpired: vi.fn().mockReturnValue(false),
  mockRefreshAccessToken: vi.fn(),
  mockEncryptTokens: vi.fn().mockReturnValue({ _encrypted: true, iv: 'x', data: 'y', tag: 'z' }),
  mockDecryptTokens: vi.fn().mockReturnValue({ access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 3600000 }),
  mockIsEncryptedTokens: vi.fn(),
}))

vi.mock('./database', () => ({
  db: {
    getEmailAccount: (...args: unknown[]) => mockGetEmailAccount(...args),
    upsertEmailAccount: (...args: unknown[]) => mockUpsertEmailAccount(...args),
  },
}))

vi.mock('./env', () => ({
  env: {
    gmailUserEmail: 'test@gmail.com',
    googleClientId: 'test-id',
    googleClientSecret: 'test-secret',
    googleRedirectUri: 'http://localhost/cb',
  },
}))

vi.mock('./gmail', () => ({
  GmailService: vi.fn().mockImplementation(function(this: any) {
    this.setCredentials = mockSetCredentials
    this.isTokenExpired = mockIsTokenExpired
    this.refreshAccessToken = mockRefreshAccessToken
  }),
}))

vi.mock('./token-encryption', () => ({
  encryptTokens: (...args: unknown[]) => mockEncryptTokens(...args),
  decryptTokens: (...args: unknown[]) => mockDecryptTokens(...args),
  isEncryptedTokens: (...args: unknown[]) => mockIsEncryptedTokens(...args),
}))

import { getAuthenticatedGmailService } from './gmail-auth'

describe('getAuthenticatedGmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTokenExpired.mockReturnValue(false)
    mockDecryptTokens.mockReturnValue({ access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 3600000 })
  })

  it('returns null when no email account exists', async () => {
    mockGetEmailAccount.mockResolvedValueOnce(null)
    const result = await getAuthenticatedGmailService()
    expect(result).toBeNull()
  })

  it('returns null when account has no tokens', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({ email_address: 'test@gmail.com', oauth_tokens: null })
    const result = await getAuthenticatedGmailService()
    expect(result).toBeNull()
  })

  it('decrypts encrypted tokens', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      email_address: 'test@gmail.com',
      oauth_tokens: { _encrypted: true, iv: 'a', data: 'b', tag: 'c' },
    })
    mockIsEncryptedTokens.mockReturnValueOnce(true)

    const result = await getAuthenticatedGmailService()
    expect(result).toBeTruthy()
    expect(mockDecryptTokens).toHaveBeenCalled()
    expect(mockSetCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'at', refresh_token: 'rt' })
    )
  })

  it('handles legacy plaintext tokens and migrates', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      email_address: 'test@gmail.com',
      oauth_tokens: { access_token: 'plain-at', refresh_token: 'plain-rt' },
    })
    mockIsEncryptedTokens.mockReturnValueOnce(false)
    mockUpsertEmailAccount.mockResolvedValueOnce({})

    const result = await getAuthenticatedGmailService()
    expect(result).toBeTruthy()
    expect(mockDecryptTokens).not.toHaveBeenCalled()
    expect(mockEncryptTokens).toHaveBeenCalled()
    expect(mockUpsertEmailAccount).toHaveBeenCalled()
  })

  it('refreshes expired tokens and persists', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      email_address: 'test@gmail.com',
      oauth_tokens: { _encrypted: true, iv: 'a', data: 'b', tag: 'c' },
    })
    mockIsEncryptedTokens.mockReturnValueOnce(true)
    mockIsTokenExpired.mockReturnValueOnce(true)
    mockRefreshAccessToken.mockResolvedValueOnce({ access_token: 'new-at', expiry_date: 999 })
    mockUpsertEmailAccount.mockResolvedValueOnce({})

    const result = await getAuthenticatedGmailService()
    expect(result).toBeTruthy()
    expect(mockRefreshAccessToken).toHaveBeenCalled()
    expect(mockUpsertEmailAccount).toHaveBeenCalled()
  })

  it('returns null when refresh fails', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      email_address: 'test@gmail.com',
      oauth_tokens: { _encrypted: true, iv: 'a', data: 'b', tag: 'c' },
    })
    mockIsEncryptedTokens.mockReturnValueOnce(true)
    mockIsTokenExpired.mockReturnValueOnce(true)
    mockRefreshAccessToken.mockResolvedValueOnce(null)

    const result = await getAuthenticatedGmailService()
    expect(result).toBeNull()
  })

  it('does not persist when tokens are fresh and already encrypted', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      email_address: 'test@gmail.com',
      oauth_tokens: { _encrypted: true, iv: 'a', data: 'b', tag: 'c' },
    })
    mockIsEncryptedTokens.mockReturnValueOnce(true)
    mockIsTokenExpired.mockReturnValueOnce(false)

    await getAuthenticatedGmailService()
    expect(mockUpsertEmailAccount).not.toHaveBeenCalled()
  })
})
