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

describe('GET /api/emails/drafts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty drafts when no recent emails', async () => {
    mockGetRecentEmails.mockResolvedValueOnce([])
    const res = await GET()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.drafts).toEqual([])
  })

  it('generates drafts from recent emails', async () => {
    mockGetRecentEmails.mockResolvedValueOnce([
      { subject: 'Quote', sender_name: 'Vendor', sender_email: 'v@test.com', body_text: 'Here is quote', received_date: '2026-01-15' },
    ])
    mockAnalyzeProjectEmails.mockResolvedValueOnce({ actionItems: [], nextSteps: [], openQuestions: [], keyDataPoints: [], overallStatus: 'ok', urgentMatters: [] })
    mockGenerateDraftEmails.mockResolvedValueOnce([{ id: 'draft-1', to: 'v@test.com', subject: 'Re: Quote', body: '<p>Thanks</p>', status: 'draft' }])

    const res = await GET()
    const json = await res.json()
    expect(json.data.drafts).toHaveLength(1)
  })
})
