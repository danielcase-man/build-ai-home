import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetRecentEmails, mockAnalyzeProjectEmails, mockGenerateDraftEmails } = vi.hoisted(() => ({
  mockGetRecentEmails: vi.fn(),
  mockAnalyzeProjectEmails: vi.fn(),
  mockGenerateDraftEmails: vi.fn(),
}))

vi.mock('@/lib/database', () => ({
  db: { getRecentEmails: mockGetRecentEmails },
}))

vi.mock('@/lib/claude-email-agent', () => ({
  analyzeProjectEmails: mockAnalyzeProjectEmails,
  generateDraftEmails: mockGenerateDraftEmails,
}))

import { GET } from './route'

const emptyInsights = { actionItems: [], nextSteps: [], openQuestions: [], keyDataPoints: [], overallStatus: 'ok', urgentMatters: [] }

describe('GET /api/emails/drafts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty drafts when no recent emails', async () => {
    mockGetRecentEmails.mockResolvedValueOnce([])
    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.drafts).toEqual([])
  })

  it('generates drafts from recent emails with thread grouping', async () => {
    mockGetRecentEmails.mockResolvedValueOnce([
      { subject: 'Quote', sender_name: 'Vendor', sender_email: 'v@test.com', body_text: 'Here is quote', received_date: '2026-03-27', thread_id: 'thread-1' },
    ])
    mockAnalyzeProjectEmails.mockResolvedValueOnce(emptyInsights)
    mockGenerateDraftEmails.mockResolvedValueOnce([{ id: 'draft-1', to: 'v@test.com', subject: 'Re: Quote', body: '<p>Thanks</p>', status: 'draft' }])

    const res = await GET()
    const json = await res.json()
    expect(json.data.drafts).toHaveLength(1)
  })

  it('passes 14-day window to getRecentEmails', async () => {
    mockGetRecentEmails.mockResolvedValueOnce([])
    await GET()
    expect(mockGetRecentEmails).toHaveBeenCalledWith(14)
  })

  it('groups emails by thread_id and marks Daniel sent emails', async () => {
    const now = new Date().toISOString()
    mockGetRecentEmails.mockResolvedValueOnce([
      { subject: 'Contract', sender_name: 'Aaron', sender_email: 'aaron@ubuildit.com', body_text: 'Sending contract', received_date: now, thread_id: 'thread-A' },
      { subject: 'Re: Contract', sender_name: 'Daniel Case', sender_email: 'danielcase.info@gmail.com', body_text: 'Got it, reviewing', received_date: now, thread_id: 'thread-A' },
      { subject: 'Bid ready', sender_name: 'Vendor', sender_email: 'vendor@test.com', body_text: 'Your bid', received_date: now, thread_id: 'thread-B' },
    ])
    mockAnalyzeProjectEmails.mockResolvedValueOnce(emptyInsights)
    mockGenerateDraftEmails.mockResolvedValueOnce([])

    await GET()

    // Verify generateDraftEmails received threads (not flat emails)
    const threadsArg = mockGenerateDraftEmails.mock.calls[0][1]
    expect(Array.isArray(threadsArg)).toBe(true)
    expect(threadsArg).toHaveLength(2) // two threads

    const threadA = threadsArg.find((t: { threadId: string }) => t.threadId === 'thread-A')
    expect(threadA).toBeDefined()
    expect(threadA.danielReplied).toBe(true)
    expect(threadA.messages).toHaveLength(2)
    expect(threadA.messages[1].direction).toBe('sent')

    const threadB = threadsArg.find((t: { threadId: string }) => t.threadId === 'thread-B')
    expect(threadB).toBeDefined()
    expect(threadB.danielReplied).toBe(false)
    expect(threadB.messages).toHaveLength(1)
    expect(threadB.messages[0].direction).toBe('received')
  })

  it('filters to 7-day window for insight analysis but 14-day for threads', async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10)
    const recentDate = new Date().toISOString()

    mockGetRecentEmails.mockResolvedValueOnce([
      { subject: 'Old email', sender_email: 'old@test.com', body_text: 'Old msg', received_date: oldDate.toISOString(), thread_id: 'thread-old' },
      { subject: 'New email', sender_email: 'new@test.com', body_text: 'New msg', received_date: recentDate, thread_id: 'thread-new' },
    ])
    mockAnalyzeProjectEmails.mockResolvedValueOnce(emptyInsights)
    mockGenerateDraftEmails.mockResolvedValueOnce([])

    await GET()

    // analyzeProjectEmails should only get the recent email (7-day window)
    const insightEmails = mockAnalyzeProjectEmails.mock.calls[0][0]
    expect(insightEmails).toHaveLength(1)
    expect(insightEmails[0].subject).toBe('New email')

    // generateDraftEmails should get all threads (14-day window)
    const threads = mockGenerateDraftEmails.mock.calls[0][1]
    expect(threads).toHaveLength(2)
  })
})
