import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetRecentEmails,
  mockGetEmailAccount,
  mockEmailExists,
  mockStoreEmails,
  mockStoreEmailAttachments,
  mockGetLatestProjectStatus,
  mockBuildEmailSearchQuery,
  mockGetAuthenticatedGmailService,
  mockSummarizeEmail,
  mockTriageEmail,
  mockGetProject,
  mockUpdateProjectStatus,
  mockGetEmails,
  mockCreateEmailSyncNotification,
} = vi.hoisted(() => ({
  mockGetRecentEmails: vi.fn(),
  mockGetEmailAccount: vi.fn(),
  mockEmailExists: vi.fn(),
  mockStoreEmails: vi.fn(),
  mockStoreEmailAttachments: vi.fn(),
  mockGetLatestProjectStatus: vi.fn(),
  mockBuildEmailSearchQuery: vi.fn(),
  mockGetAuthenticatedGmailService: vi.fn(),
  mockSummarizeEmail: vi.fn(),
  mockTriageEmail: vi.fn(),
  mockGetProject: vi.fn(),
  mockUpdateProjectStatus: vi.fn(),
  mockGetEmails: vi.fn(),
  mockCreateEmailSyncNotification: vi.fn(),
}))

vi.mock('@/lib/database', () => ({
  db: {
    getRecentEmails: mockGetRecentEmails,
    getEmailAccount: mockGetEmailAccount,
    emailExists: mockEmailExists,
    storeEmails: mockStoreEmails,
    storeEmailAttachments: mockStoreEmailAttachments,
    getLatestProjectStatus: mockGetLatestProjectStatus,
    buildEmailSearchQuery: mockBuildEmailSearchQuery,
  },
}))

vi.mock('@/lib/gmail-auth', () => ({
  getAuthenticatedGmailService: mockGetAuthenticatedGmailService,
}))

vi.mock('@/lib/claude-email-agent', () => ({
  summarizeEmail: mockSummarizeEmail,
  triageEmail: mockTriageEmail,
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
  updateProjectStatus: mockUpdateProjectStatus,
}))

vi.mock('@/lib/notification-service', () => ({
  createEmailSyncNotification: mockCreateEmailSyncNotification,
}))

vi.mock('@/lib/ui-helpers', () => ({
  extractEmailAddress: (s: string) => s.replace(/.*</, '').replace(/>.*/, ''),
  extractSenderName: (s: string) => s.replace(/<.*/, '').trim(),
}))

vi.mock('@/lib/errors', () => {
  class AppError extends Error {
    statusCode: number
    code?: string
    constructor(message: string, statusCode = 500, code?: string) {
      super(message)
      this.statusCode = statusCode
      this.code = code
    }
  }
  class AuthenticationError extends AppError {
    constructor(message = 'Not authenticated') {
      super(message, 401, 'AUTH_REQUIRED')
    }
  }
  return { AppError, AuthenticationError }
})

import { GET } from './route'

describe('GET /api/emails/fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockGetLatestProjectStatus.mockResolvedValue(null)
    mockUpdateProjectStatus.mockResolvedValue(undefined)
    mockCreateEmailSyncNotification.mockResolvedValue(undefined)
  })

  it('returns stored emails from database when available', async () => {
    const stored = [
      {
        message_id: 'msg-1',
        thread_id: 't-1',
        subject: 'Bid from vendor',
        sender_name: 'Vendor',
        sender_email: 'vendor@test.com',
        received_date: '2026-03-15',
        body_text: 'Here is our bid for the foundation work.',
        ai_summary: 'Foundation bid received',
      },
    ]
    mockGetRecentEmails.mockResolvedValueOnce(stored)

    const req = new NextRequest('http://localhost/api/emails/fetch')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.emails).toHaveLength(1)
    expect(json.data.emails[0].subject).toBe('Bid from vendor')
    expect(json.data.source).toBe('database')
    expect(mockGetAuthenticatedGmailService).not.toHaveBeenCalled()
  })

  it('fetches from Gmail API when database is empty', async () => {
    mockGetRecentEmails.mockResolvedValueOnce([])
    mockGetAuthenticatedGmailService.mockResolvedValueOnce({
      getEmails: mockGetEmails,
    })
    mockGetEmails.mockResolvedValueOnce([
      {
        id: 'msg-2',
        threadId: 't-2',
        subject: 'Quote update',
        from: 'Plumber <plumber@test.com>',
        body: 'Updated quote attached.',
        date: '2026-03-16',
        snippet: 'Updated quote',
      },
    ])
    mockBuildEmailSearchQuery.mockResolvedValueOnce('from:@test.com newer_than:7d')
    mockSummarizeEmail.mockResolvedValueOnce({ summary: 'Updated plumbing quote' })
    mockTriageEmail.mockResolvedValueOnce({ priority: 'medium', category: 'bid' })
    mockEmailExists.mockResolvedValueOnce(false)
    mockGetEmailAccount.mockResolvedValueOnce({ id: 'ea-1' })
    mockStoreEmails.mockResolvedValueOnce([{ id: 'db-1', message_id: 'msg-2' }])

    const req = new NextRequest('http://localhost/api/emails/fetch')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(1)
    expect(json.data.source).toBe('gmail-api')
    expect(mockStoreEmails).toHaveBeenCalled()
    expect(mockUpdateProjectStatus).toHaveBeenCalledWith('proj-1')
  })

  it('fetches from Gmail API on force refresh', async () => {
    const stored = [
      {
        message_id: 'msg-1',
        thread_id: 't-1',
        subject: 'Old email',
        sender_name: 'Sender',
        sender_email: 'sender@test.com',
        received_date: '2026-03-10',
        body_text: 'Old content',
        ai_summary: 'Old summary',
      },
    ]
    mockGetRecentEmails.mockResolvedValueOnce(stored)
    mockGetAuthenticatedGmailService.mockResolvedValueOnce({
      getEmails: mockGetEmails,
    })
    mockGetEmails.mockResolvedValueOnce([])
    mockBuildEmailSearchQuery.mockResolvedValueOnce('newer_than:7d')

    const req = new NextRequest('http://localhost/api/emails/fetch?refresh=true')
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.source).toBe('gmail-api')
    expect(mockGetAuthenticatedGmailService).toHaveBeenCalled()
  })

  it('returns error when Gmail auth fails', async () => {
    mockGetRecentEmails.mockResolvedValueOnce([])
    mockGetAuthenticatedGmailService.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/emails/fetch')
    const res = await GET(req)
    // AuthenticationError extends AppError with statusCode 401
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('skips already-existing emails when storing', async () => {
    mockGetRecentEmails.mockResolvedValueOnce([])
    mockGetAuthenticatedGmailService.mockResolvedValueOnce({
      getEmails: mockGetEmails,
    })
    mockGetEmails.mockResolvedValueOnce([
      {
        id: 'msg-existing',
        threadId: 't-1',
        subject: 'Already stored',
        from: 'x@test.com',
        body: 'content',
        date: '2026-03-15',
        snippet: '',
      },
    ])
    mockBuildEmailSearchQuery.mockResolvedValueOnce('newer_than:7d')
    mockSummarizeEmail.mockResolvedValueOnce({ summary: 'Summary' })
    mockTriageEmail.mockResolvedValueOnce({ priority: 'low' })
    mockEmailExists.mockResolvedValueOnce(true) // already exists

    const req = new NextRequest('http://localhost/api/emails/fetch')
    const res = await GET(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(mockStoreEmails).not.toHaveBeenCalled()
  })
})
