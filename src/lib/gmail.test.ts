import { describe, it, expect, vi, beforeEach } from 'vitest'

// Declare mocks via vi.hoisted so they're available inside vi.mock factory
const {
  mockGenerateAuthUrl,
  mockGetToken,
  mockRefreshAccessToken,
  mockSetCredentials,
  mockMessagesList,
  mockMessagesGet,
  mockMessagesSend,
  mockMessagesModify,
  mockCredentials,
} = vi.hoisted(() => ({
  mockGenerateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1'),
  mockGetToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'at', refresh_token: 'rt' } }),
  mockRefreshAccessToken: vi.fn().mockResolvedValue({
    credentials: { access_token: 'new-at', expiry_date: Date.now() + 3600000 },
  }),
  mockSetCredentials: vi.fn(),
  mockMessagesList: vi.fn(),
  mockMessagesGet: vi.fn(),
  mockMessagesSend: vi.fn(),
  mockMessagesModify: vi.fn(),
  mockCredentials: { value: {} as Record<string, unknown> },
}))

vi.mock('googleapis', () => {
  // Use a real function constructor so `new google.auth.OAuth2()` works
  function MockOAuth2() {
    // @ts-ignore
    this.generateAuthUrl = mockGenerateAuthUrl
    // @ts-ignore
    this.getToken = mockGetToken
    // @ts-ignore
    this.refreshAccessToken = mockRefreshAccessToken
    // @ts-ignore
    this.setCredentials = mockSetCredentials
    // @ts-ignore
    Object.defineProperty(this, 'credentials', {
      get: () => mockCredentials.value,
    })
  }

  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
      gmail: vi.fn().mockReturnValue({
        users: {
          messages: {
            list: mockMessagesList,
            get: mockMessagesGet,
            send: mockMessagesSend,
            modify: mockMessagesModify,
          },
        },
      }),
    },
  }
})

vi.mock('./env', () => ({
  env: {
    googleClientId: 'test-id',
    googleClientSecret: 'test-secret',
    googleRedirectUri: 'http://localhost/cb',
  },
}))

import { GmailService } from './gmail'

describe('GmailService', () => {
  let service: GmailService

  beforeEach(() => {
    vi.clearAllMocks()
    mockCredentials.value = {}
    service = new GmailService()
  })

  describe('getAuthUrl', () => {
    it('generates auth URL with offline access', () => {
      const url = service.getAuthUrl()
      expect(url).toContain('accounts.google.com')
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ access_type: 'offline' })
      )
    })
  })

  describe('getTokens', () => {
    it('exchanges code for tokens', async () => {
      const tokens = await service.getTokens('auth-code-123')
      expect(tokens).toEqual({ access_token: 'at', refresh_token: 'rt' })
      expect(mockGetToken).toHaveBeenCalledWith('auth-code-123')
    })
  })

  describe('isTokenExpired', () => {
    it('returns false when no expiry_date set', () => {
      mockCredentials.value = {}
      expect(service.isTokenExpired()).toBe(false)
    })

    it('returns true when token is about to expire', () => {
      mockCredentials.value = { expiry_date: Date.now() + 1000 } // < 5 min
      expect(service.isTokenExpired()).toBe(true)
    })

    it('returns false when token is fresh', () => {
      mockCredentials.value = { expiry_date: Date.now() + 10 * 60 * 1000 } // 10 min
      expect(service.isTokenExpired()).toBe(false)
    })
  })

  describe('refreshAccessToken', () => {
    it('returns new credentials on success', async () => {
      const result = await service.refreshAccessToken()
      expect(result).toHaveProperty('access_token')
      expect(result).toHaveProperty('expiry_date')
    })

    it('returns null on failure', async () => {
      mockRefreshAccessToken.mockRejectedValueOnce(new Error('refresh failed'))
      const result = await service.refreshAccessToken()
      expect(result).toBeNull()
    })
  })

  describe('getEmails', () => {
    it('returns parsed emails', async () => {
      mockMessagesList.mockResolvedValueOnce({
        data: { messages: [{ id: 'msg-1' }] },
      })
      mockMessagesGet.mockResolvedValueOnce({
        data: {
          id: 'msg-1',
          threadId: 'thread-1',
          snippet: 'test snippet',
          payload: {
            headers: [
              { name: 'Subject', value: 'Test Subject' },
              { name: 'From', value: 'sender@test.com' },
              { name: 'Date', value: '2026-01-15' },
            ],
            body: { data: Buffer.from('Hello world').toString('base64') },
          },
        },
      })

      const emails = await service.getEmails('from:test@test.com')
      expect(emails).toHaveLength(1)
      expect(emails[0].subject).toBe('Test Subject')
      expect(emails[0].from).toBe('sender@test.com')
      expect(emails[0].body).toBe('Hello world')
    })

    it('returns empty array when no messages', async () => {
      mockMessagesList.mockResolvedValueOnce({ data: { messages: null } })
      const emails = await service.getEmails('query')
      expect(emails).toEqual([])
    })

    it('returns empty array on API error', async () => {
      mockMessagesList.mockRejectedValueOnce(new Error('API error'))
      const emails = await service.getEmails('query')
      expect(emails).toEqual([])
    })

    it('parses multipart MIME with text/plain', async () => {
      mockMessagesList.mockResolvedValueOnce({ data: { messages: [{ id: 'msg-2' }] } })
      mockMessagesGet.mockResolvedValueOnce({
        data: {
          id: 'msg-2', threadId: 'thread-2', snippet: 'snippet',
          payload: {
            headers: [
              { name: 'Subject', value: 'Multi' },
              { name: 'From', value: 'x@test.com' },
              { name: 'Date', value: '2026-01-15' },
            ],
            parts: [
              { mimeType: 'text/plain', body: { data: Buffer.from('Plain text body').toString('base64') } },
              { mimeType: 'text/html', body: { data: Buffer.from('<p>HTML body</p>').toString('base64') } },
            ],
          },
        },
      })

      const emails = await service.getEmails('query')
      expect(emails[0].body).toBe('Plain text body')
    })

    it('falls back to text/html when no text/plain', async () => {
      mockMessagesList.mockResolvedValueOnce({ data: { messages: [{ id: 'msg-3' }] } })
      mockMessagesGet.mockResolvedValueOnce({
        data: {
          id: 'msg-3', threadId: 'thread-3', snippet: 'snippet',
          payload: {
            headers: [
              { name: 'Subject', value: 'HTML Only' },
              { name: 'From', value: 'x@test.com' },
              { name: 'Date', value: '2026-01-15' },
            ],
            parts: [
              { mimeType: 'text/html', body: { data: Buffer.from('<p>Hello</p>').toString('base64') } },
            ],
          },
        },
      })

      const emails = await service.getEmails('query')
      expect(emails[0].body).toContain('Hello')
      expect(emails[0].body).not.toContain('<p>')
    })

    it('handles nested multipart MIME', async () => {
      mockMessagesList.mockResolvedValueOnce({ data: { messages: [{ id: 'msg-4' }] } })
      mockMessagesGet.mockResolvedValueOnce({
        data: {
          id: 'msg-4', threadId: 'thread-4', snippet: 'snippet',
          payload: {
            headers: [
              { name: 'Subject', value: 'Nested' },
              { name: 'From', value: 'x@test.com' },
              { name: 'Date', value: '2026-01-15' },
            ],
            parts: [{
              mimeType: 'multipart/alternative',
              body: {},
              parts: [
                { mimeType: 'text/plain', body: { data: Buffer.from('Nested plain').toString('base64') } },
              ],
            }],
          },
        },
      })

      const emails = await service.getEmails('query')
      expect(emails[0].body).toBe('Nested plain')
    })
  })

  describe('sendEmail', () => {
    it('sends email and returns message id', async () => {
      mockMessagesSend.mockResolvedValueOnce({ data: { id: 'sent-1' } })
      const result = await service.sendEmail('to@test.com', 'Subject', '<p>Body</p>')
      expect(result).toBe('sent-1')
    })

    it('returns null on failure', async () => {
      mockMessagesSend.mockRejectedValueOnce(new Error('send failed'))
      const result = await service.sendEmail('to@test.com', 'Subject', '<p>Body</p>')
      expect(result).toBeNull()
    })
  })

  describe('sendEmail - MIME injection protection', () => {
    it('strips CRLF from to and subject fields preventing header injection', async () => {
      mockMessagesSend.mockResolvedValueOnce({ data: { id: 'sent-safe' } })
      await service.sendEmail(
        'to@test.com\r\nBcc: evil@attacker.com',
        'Normal Subject\r\nX-Injected: header',
        '<p>Body</p>'
      )
      const callArgs = mockMessagesSend.mock.calls[0][0]
      const rawBase64 = callArgs.requestBody.raw
      const decoded = Buffer.from(rawBase64, 'base64').toString()
      // CRLF stripped — injected headers are collapsed into the field value, not separate headers
      const lines = decoded.split('\r\n')
      const toLine = lines.find(l => l.startsWith('To:'))
      const subjectLine = lines.find(l => l.startsWith('Subject:'))
      // No separate Bcc or X-Injected header lines
      expect(lines.filter(l => l.startsWith('Bcc:'))).toHaveLength(0)
      expect(lines.filter(l => l.startsWith('X-Injected:'))).toHaveLength(0)
      // The To field should not contain newlines
      expect(toLine).not.toContain('\r')
      expect(toLine).not.toContain('\n')
      expect(subjectLine).not.toContain('\r')
    })
  })

  describe('markAsRead', () => {
    it('calls modify to remove UNREAD label', async () => {
      mockMessagesModify.mockResolvedValueOnce({})
      await service.markAsRead('msg-1')
      expect(mockMessagesModify).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          requestBody: { removeLabelIds: ['UNREAD'] },
        })
      )
    })
  })
})
