import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeEmail, makeEmailThread, makeThreadedEmail } from '@/test/helpers'

const mockCreate = vi.fn()

vi.mock('./ai-clients', () => ({
  getAnthropicClient: () => ({
    messages: { create: mockCreate },
  }),
  parseAIJsonResponse: (text: string) => {
    let t = text.trim()
    if (t.startsWith('```json')) t = t.replace(/^```json\n/, '').replace(/\n```$/, '')
    else if (t.startsWith('```')) t = t.replace(/^```\n/, '').replace(/\n```$/, '')
    return JSON.parse(t)
  },
}))

import { summarizeEmail, analyzeProjectEmails, triageEmail, generateDraftEmails } from './claude-email-agent'
import type { ProjectInsights } from '@/types'

describe('summarizeEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns parsed insights', async () => {
    const insights = {
      actionItems: [{ item: 'Review bid', priority: 'high' }],
      nextSteps: ['Schedule meeting'],
      questions: [],
      keyDataPoints: [],
      summary: 'Bid received from vendor.',
    }
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(insights) }] })

    const result = await summarizeEmail(makeEmail())
    expect(result.actionItems).toHaveLength(1)
    expect(result.summary).toBe('Bid received from vendor.')
  })

  it('uses Sonnet model', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ actionItems: [], nextSteps: [], questions: [], keyDataPoints: [], summary: 'ok' }) }],
    })
    await summarizeEmail(makeEmail())
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-sonnet-4-6' }))
  })

  it('returns empty insights on error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('fail'))
    const result = await summarizeEmail(makeEmail())
    expect(result.actionItems).toEqual([])
    expect(result.summary).toBe('Unable to generate insights')
  })
})

describe('analyzeProjectEmails', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty insights for empty array', async () => {
    const result = await analyzeProjectEmails([])
    expect(result.overallStatus).toBe('Unable to generate project insights')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('analyzes multiple emails with Sonnet', async () => {
    const insights = {
      actionItems: [],
      nextSteps: [],
      openQuestions: [],
      keyDataPoints: [],
      overallStatus: 'Project on track',
      urgentMatters: [],
    }
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(insights) }] })

    const result = await analyzeProjectEmails([makeEmail(), makeEmail({ subject: 'Follow-up' })])
    expect(result.overallStatus).toBe('Project on track')
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-sonnet-4-6' }))
  })

  it('truncates emails to 20', async () => {
    const emails = Array.from({ length: 25 }, (_, i) => makeEmail({ subject: `Email ${i}` }))
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ actionItems: [], nextSteps: [], openQuestions: [], keyDataPoints: [], overallStatus: 'ok', urgentMatters: [] }) }],
    })
    await analyzeProjectEmails(emails)

    const prompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(prompt).toContain('EMAIL 20')
    expect(prompt).not.toContain('EMAIL 21')
  })
})

describe('triageEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns triage result', async () => {
    const triage = { urgent: true, priority: 'critical', reason: 'Safety issue', suggestedAction: 'Call immediately' }
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(triage) }] })

    const result = await triageEmail(makeEmail())
    expect(result.urgent).toBe(true)
    expect(result.priority).toBe('critical')
  })

  it('returns default on error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('fail'))
    const result = await triageEmail(makeEmail())
    expect(result.urgent).toBe(false)
    expect(result.priority).toBe('medium')
    expect(result.suggestedAction).toBe('Manual review recommended')
  })
})

describe('generateDraftEmails', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array for no threads', async () => {
    const insights: ProjectInsights = {
      actionItems: [],
      nextSteps: [],
      openQuestions: [],
      keyDataPoints: [],
      overallStatus: '',
      urgentMatters: [],
    }
    const result = await generateDraftEmails(insights, [])
    expect(result).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('generates drafts with IDs and status from threads', async () => {
    const drafts = [
      { to: 'vendor@test.com', toName: 'Vendor', subject: 'Follow up', body: '<p>Hi</p>', reason: 'Need update', priority: 'high', relatedActionItem: 'Get bid' },
    ]
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(drafts) }] })

    const insights: ProjectInsights = {
      actionItems: [{ item: 'Get bid', priority: 'high' }],
      nextSteps: [],
      openQuestions: [],
      keyDataPoints: [],
      overallStatus: '',
      urgentMatters: [],
    }
    const result = await generateDraftEmails(insights, [makeEmailThread()])
    expect(result).toHaveLength(1)
    expect(result[0].id).toMatch(/^draft-/)
    expect(result[0].status).toBe('draft')
    expect(result[0].to).toBe('vendor@test.com')
  })

  it('includes thread context with danielReplied flag in prompt', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: '[]' }] })

    const insights: ProjectInsights = {
      actionItems: [],
      nextSteps: [],
      openQuestions: [],
      keyDataPoints: [],
      overallStatus: '',
      urgentMatters: [],
    }

    const thread = makeEmailThread({
      messages: [
        makeThreadedEmail({ from: 'aaron@ubuildit.com', direction: 'received', date: '2026-03-20' }),
        makeThreadedEmail({ from: 'danielcase.info@gmail.com', direction: 'sent', date: '2026-03-22' }),
      ],
    })
    await generateDraftEmails(insights, [thread])

    const prompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(prompt).toContain("TODAY'S DATE:")
    expect(prompt).toContain('DANIEL SENT')
    expect(prompt).toContain('Daniel has replied in this thread: YES')
    expect(prompt).toContain('Staleness check')
  })

  it('returns empty array on error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('fail'))
    const insights: ProjectInsights = {
      actionItems: [],
      nextSteps: [],
      openQuestions: [],
      keyDataPoints: [],
      overallStatus: '',
      urgentMatters: [],
    }
    const result = await generateDraftEmails(insights, [makeEmailThread()])
    expect(result).toEqual([])
  })

  it('sanitizes XSS from AI-generated draft bodies (P0 fix)', async () => {
    const drafts = [
      {
        to: 'vendor@test.com',
        toName: 'Vendor',
        subject: 'Follow up',
        body: '<p>Hello</p><script>alert("xss")</script><img onerror="alert(1)" src=x><a href="javascript:alert(1)">Click</a>',
        reason: 'Test',
        priority: 'high',
      },
    ]
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(drafts) }] })

    const insights: ProjectInsights = {
      actionItems: [{ item: 'Test', priority: 'high' }],
      nextSteps: [],
      openQuestions: [],
      keyDataPoints: [],
      overallStatus: '',
      urgentMatters: [],
    }
    const result = await generateDraftEmails(insights, [makeEmailThread()])
    expect(result[0].body).not.toContain('<script>')
    expect(result[0].body).not.toContain('onerror')
    expect(result[0].body).not.toContain('javascript:')
    expect(result[0].body).toContain('<p>Hello</p>')
  })
})
