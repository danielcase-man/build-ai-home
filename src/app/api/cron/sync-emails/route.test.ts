import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetEmailAccount,
  mockEmailExists,
  mockStoreEmails,
  mockUpdateLastSync,
  mockBuildEmailSearchQuery,
  mockGetGmailHistoryId,
  mockUpdateGmailHistoryId,
  mockGetAuthenticatedGmailService,
  mockSummarizeIndividualEmail,
  mockGetProject,
  mockUpdateProjectStatus,
  mockGetEmails,
  mockGetProfile,
  mockCreateEmailSyncNotification,
} = vi.hoisted(() => ({
  mockGetEmailAccount: vi.fn(),
  mockEmailExists: vi.fn().mockResolvedValue(false),
  mockStoreEmails: vi.fn().mockResolvedValue([]),
  mockUpdateLastSync: vi.fn().mockResolvedValue(undefined),
  mockBuildEmailSearchQuery: vi.fn().mockResolvedValue('from:@ubuildit.com newer_than:2d'),
  mockGetGmailHistoryId: vi.fn().mockResolvedValue(null),
  mockUpdateGmailHistoryId: vi.fn().mockResolvedValue(undefined),
  mockGetAuthenticatedGmailService: vi.fn(),
  mockSummarizeIndividualEmail: vi.fn().mockResolvedValue('Summary text'),
  mockGetProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
  mockUpdateProjectStatus: vi.fn().mockResolvedValue(undefined),
  mockGetEmails: vi.fn(),
  mockGetProfile: vi.fn().mockResolvedValue({ historyId: '12345' }),
  mockCreateEmailSyncNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/database', () => ({
  db: {
    getEmailAccount: mockGetEmailAccount,
    emailExists: mockEmailExists,
    storeEmails: mockStoreEmails,
    updateLastSync: mockUpdateLastSync,
    buildEmailSearchQuery: mockBuildEmailSearchQuery,
    getGmailHistoryId: mockGetGmailHistoryId,
    updateGmailHistoryId: mockUpdateGmailHistoryId,
  },
}))

vi.mock('@/lib/notification-service', () => ({
  createEmailSyncNotification: mockCreateEmailSyncNotification,
}))

vi.mock('@/lib/gmail-auth', () => ({
  getAuthenticatedGmailService: mockGetAuthenticatedGmailService,
}))

vi.mock('@/lib/ai-summarization', () => ({
  summarizeIndividualEmail: mockSummarizeIndividualEmail,
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
  updateProjectStatus: mockUpdateProjectStatus,
}))

vi.mock('@/lib/ui-helpers', () => ({
  extractEmailAddress: (s: string) => s.replace(/.*</, '').replace(/>.*/, ''),
  extractSenderName: (s: string) => s.replace(/<.*/, '').trim(),
}))

vi.mock('@/lib/env', () => ({
  env: { cronSecret: 'cron-secret', gmailUserEmail: 'test@gmail.com' },
}))

import { POST, GET } from './route'

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/cron/sync-emails', {
    method: 'POST',
    headers,
  })
}

describe('POST /api/cron/sync-emails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEmailAccount.mockResolvedValue({
      id: 'ea-1',
      email_address: 'test@gmail.com',
      last_sync: new Date(0).toISOString(), // long ago
      sync_frequency: 30,
    })
    mockGetAuthenticatedGmailService.mockResolvedValue({
      getEmails: mockGetEmails,
      getProfile: mockGetProfile,
      getHistoryChanges: vi.fn().mockResolvedValue(null),
      getEmailById: vi.fn().mockResolvedValue(null),
    })
    mockGetEmails.mockResolvedValue([])
  })

  it('rejects missing auth header', async () => {
    const res = await POST(makeReq())
    expect(res.status).toBe(401)
  })

  it('rejects invalid token', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns success when no emails found', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.synced).toBe(0)
  })

  it('processes new emails', async () => {
    mockGetEmails.mockResolvedValueOnce([
      { id: 'msg-1', threadId: 't-1', subject: 'Quote', from: 'vendor@test.com', body: 'Bid details', date: '2026-01-15', snippet: 'Bid' },
    ])
    mockEmailExists.mockResolvedValueOnce(false)

    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.synced).toBe(1)
    expect(mockStoreEmails).toHaveBeenCalled()
    expect(mockSummarizeIndividualEmail).toHaveBeenCalled()
  })

  it('skips already-existing emails', async () => {
    mockGetEmails.mockResolvedValueOnce([
      { id: 'msg-1', threadId: 't-1', subject: 'Old', from: 'x@test.com', body: 'old email', date: '2026-01-10', snippet: '' },
    ])
    mockEmailExists.mockResolvedValueOnce(true)

    const res = await POST(makeReq({ authorization: 'Bearer cron-secret' }))
    const json = await res.json()
    expect(json.data.synced).toBe(0)
  })
})
