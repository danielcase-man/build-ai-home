import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  mockCreateEmailSyncNotification,
} = vi.hoisted(() => ({
  mockGetEmailAccount: vi.fn(),
  mockEmailExists: vi.fn(),
  mockStoreEmails: vi.fn(),
  mockUpdateLastSync: vi.fn(),
  mockBuildEmailSearchQuery: vi.fn(),
  mockGetGmailHistoryId: vi.fn(),
  mockUpdateGmailHistoryId: vi.fn(),
  mockGetAuthenticatedGmailService: vi.fn(),
  mockSummarizeIndividualEmail: vi.fn(),
  mockGetProject: vi.fn(),
  mockUpdateProjectStatus: vi.fn(),
  mockCreateEmailSyncNotification: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/env', () => ({
  env: { gmailUserEmail: 'test@gmail.com' },
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

vi.mock('@/lib/gmail-auth', () => ({
  getAuthenticatedGmailService: mockGetAuthenticatedGmailService,
}))

vi.mock('@/lib/ai-summarization', () => ({
  summarizeIndividualEmail: mockSummarizeIndividualEmail,
}))

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

import { POST, GET } from './route'

describe('POST /api/emails/background-sync', () => {
  const recentSync = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 mins ago
  const staleSync = new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 mins ago

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
    mockUpdateProjectStatus.mockResolvedValue(undefined)
    mockCreateEmailSyncNotification.mockResolvedValue(undefined)
    mockUpdateLastSync.mockResolvedValue(undefined)
  })

  it('returns needed=false when no email account configured', async () => {
    mockGetEmailAccount.mockResolvedValueOnce(null)

    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.needed).toBe(false)
    expect(json.data.reason).toBe('no_account')
  })

  it('returns needed=false when sync is fresh', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      id: 'ea-1',
      email_address: 'test@gmail.com',
      last_sync: recentSync,
    })

    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.needed).toBe(false)
    expect(json.data.reason).toBe('fresh')
  })

  it('returns no_credentials when Gmail auth fails', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      id: 'ea-1',
      email_address: 'test@gmail.com',
      last_sync: staleSync,
    })
    mockGetAuthenticatedGmailService.mockResolvedValueOnce(null)

    const res = await POST()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.needed).toBe(true)
    expect(json.data.reason).toBe('no_credentials')
  })

  it('returns no_project when no project exists', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      id: 'ea-1',
      email_address: 'test@gmail.com',
      last_sync: staleSync,
    })
    mockGetAuthenticatedGmailService.mockResolvedValueOnce({ getEmails: vi.fn() })
    mockGetProject.mockResolvedValueOnce(null)

    const res = await POST()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.needed).toBe(true)
    expect(json.data.reason).toBe('no_project')
  })

  it('syncs new emails via full fetch when no history id', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      id: 'ea-1',
      email_address: 'test@gmail.com',
      last_sync: staleSync,
    })
    const mockGetEmails = vi.fn().mockResolvedValue([
      {
        id: 'msg-1',
        threadId: 't-1',
        subject: 'Bid update',
        from: 'Vendor <vendor@test.com>',
        body: 'Here is the updated bid.',
        date: '2026-03-20',
        snippet: 'Updated bid',
      },
    ])
    const mockGetProfile = vi.fn().mockResolvedValue({ historyId: 'hist-123' })
    mockGetAuthenticatedGmailService.mockResolvedValueOnce({
      getEmails: mockGetEmails,
      getProfile: mockGetProfile,
    })
    mockGetGmailHistoryId.mockResolvedValueOnce(null) // no stored history
    mockBuildEmailSearchQuery.mockResolvedValueOnce('newer_than:2d')
    mockEmailExists.mockResolvedValueOnce(false)
    mockSummarizeIndividualEmail.mockResolvedValueOnce('Vendor sent updated bid')
    mockStoreEmails.mockResolvedValueOnce(undefined)

    const res = await POST()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.needed).toBe(true)
    expect(json.data.synced).toBe(1)
    expect(json.data.total).toBe(1)
    expect(mockStoreEmails).toHaveBeenCalled()
    expect(mockUpdateLastSync).toHaveBeenCalledWith('test@gmail.com')
    expect(mockUpdateGmailHistoryId).toHaveBeenCalledWith('test@gmail.com', 'hist-123')
    expect(mockCreateEmailSyncNotification).toHaveBeenCalledWith('proj-1', 1)
  })

  it('uses incremental sync when history id is stored', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      id: 'ea-1',
      email_address: 'test@gmail.com',
      last_sync: staleSync,
    })
    const mockGetHistoryChanges = vi.fn().mockResolvedValue({
      messageIds: ['msg-inc-1'],
      newHistoryId: 'hist-456',
    })
    const mockGetEmailById = vi.fn().mockResolvedValue({
      id: 'msg-inc-1',
      threadId: 't-inc',
      subject: 'Incremental email',
      from: 'Inc <inc@test.com>',
      body: 'Incremental body',
      date: '2026-03-21',
      snippet: 'Inc',
    })
    mockGetAuthenticatedGmailService.mockResolvedValueOnce({
      getHistoryChanges: mockGetHistoryChanges,
      getEmailById: mockGetEmailById,
    })
    mockGetGmailHistoryId.mockResolvedValueOnce('hist-old')
    mockEmailExists.mockResolvedValueOnce(false)
    mockSummarizeIndividualEmail.mockResolvedValueOnce('Incremental summary')
    mockStoreEmails.mockResolvedValueOnce(undefined)

    const res = await POST()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.synced).toBe(1)
    expect(mockGetHistoryChanges).toHaveBeenCalledWith('hist-old')
    expect(mockUpdateGmailHistoryId).toHaveBeenCalledWith('test@gmail.com', 'hist-456')
  })

  it('returns no_new_emails when incremental sync has no messages', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      id: 'ea-1',
      email_address: 'test@gmail.com',
      last_sync: staleSync,
    })
    const mockGetHistoryChanges = vi.fn().mockResolvedValue({
      messageIds: [],
      newHistoryId: 'hist-same',
    })
    mockGetAuthenticatedGmailService.mockResolvedValueOnce({
      getHistoryChanges: mockGetHistoryChanges,
    })
    mockGetGmailHistoryId.mockResolvedValueOnce('hist-old')

    const res = await POST()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.synced).toBe(0)
    expect(json.data.reason).toBe('no_new_emails')
    expect(mockUpdateLastSync).toHaveBeenCalledWith('test@gmail.com')
  })

  it('skips already-existing emails', async () => {
    mockGetEmailAccount.mockResolvedValueOnce({
      id: 'ea-1',
      email_address: 'test@gmail.com',
      last_sync: staleSync,
    })
    const mockGetEmails = vi.fn().mockResolvedValue([
      {
        id: 'msg-existing',
        threadId: 't-1',
        subject: 'Already stored',
        from: 'x@test.com',
        body: 'content',
        date: '2026-03-20',
        snippet: '',
      },
    ])
    const mockGetProfile = vi.fn().mockResolvedValue({ historyId: 'hist-new' })
    mockGetAuthenticatedGmailService.mockResolvedValueOnce({
      getEmails: mockGetEmails,
      getProfile: mockGetProfile,
    })
    mockGetGmailHistoryId.mockResolvedValueOnce(null)
    mockBuildEmailSearchQuery.mockResolvedValueOnce('newer_than:2d')
    mockEmailExists.mockResolvedValueOnce(true) // already exists

    const res = await POST()
    const json = await res.json()
    expect(json.data.synced).toBe(0)
    expect(mockStoreEmails).not.toHaveBeenCalled()
    expect(mockCreateEmailSyncNotification).not.toHaveBeenCalled()
  })

  it('handles errors gracefully', async () => {
    mockGetEmailAccount.mockRejectedValueOnce(new Error('DB down'))

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('GET delegates to POST', async () => {
    mockGetEmailAccount.mockResolvedValueOnce(null)

    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.needed).toBe(false)
    expect(json.data.reason).toBe('no_account')
  })
})
