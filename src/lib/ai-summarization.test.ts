import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeEmail } from '@/test/helpers'
import type { FullProjectContext } from './ai-summarization'

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

import {
  summarizeIndividualEmail,
  generateDailyProjectSummary,
  generateProjectStatusSnapshot,
} from './ai-summarization'

function makeFullContext(overrides?: Partial<FullProjectContext>): FullProjectContext {
  return {
    project: {
      name: 'Test Project',
      address: '123 Main St',
      phase: 'planning',
      currentStep: 3,
      totalSteps: 6,
      startDate: '2026-01-01',
      targetCompletion: '2026-12-31',
      squareFootage: 3000,
      style: 'Modern',
    },
    budget: { total: 450000, spent: 5000, remaining: 445000, items: [] },
    planningSteps: [],
    milestones: [],
    tasks: [],
    permits: [],
    contacts: [],
    vendors: [],
    bids: [],
    selections: [],
    communications: [],
    ...overrides,
  }
}

describe('summarizeIndividualEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns AI-generated summary', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Foundation bid received for $85K.' }],
    })

    const result = await summarizeIndividualEmail(makeEmail())
    expect(result).toBe('Foundation bid received for $85K.')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-6' })
    )
  })

  it('returns fallback on API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API down'))
    const result = await summarizeIndividualEmail(makeEmail())
    expect(result).toBe('Unable to generate summary')
  })

  it('returns fallback for non-text content', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'image', source: {} }],
    })
    const result = await summarizeIndividualEmail(makeEmail())
    expect(result).toBe('Unable to generate summary')
  })
})

describe('generateDailyProjectSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns generated text', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Your project is progressing well.' }],
    })

    const result = await generateDailyProjectSummary(
      { phase: 'planning', currentStep: 3, totalSteps: 6, daysElapsed: 30, totalDays: 117, budgetUsed: 5000, budgetTotal: 450000 },
      [makeEmail()],
      {}
    )
    expect(result).toBe('Your project is progressing well.')
  })

  it('returns fallback on error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('fail'))
    const result = await generateDailyProjectSummary(
      { phase: 'planning', currentStep: 1, totalSteps: 6, daysElapsed: 0, totalDays: 117, budgetUsed: 0, budgetTotal: 450000 },
      [],
      {}
    )
    expect(result).toBe('Unable to generate summary at this time.')
  })
})

describe('generateProjectStatusSnapshot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses snapshot response', async () => {
    const snapshot = {
      hot_topics: [{ priority: 'high', text: 'Permit pending' }],
      action_items: [{ status: 'pending', text: 'Call inspector' }],
      recent_decisions: [],
      next_steps: ['Schedule inspection'],
      open_questions: [{ question: 'When is the permit ready?', askedBy: 'Owner' }],
      key_data_points: [{ category: 'Timeline', data: 'Inspection in 2 weeks', importance: 'important' }],
      ai_summary: 'Project on track.',
    }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(snapshot) }],
    })

    const result = await generateProjectStatusSnapshot(
      [makeEmail()],
      makeFullContext()
    )
    expect(result.hot_topics).toHaveLength(1)
    expect(result.next_steps).toEqual(['Schedule inspection'])
    expect(result.open_questions).toHaveLength(1)
    expect(result.key_data_points).toHaveLength(1)
    expect(result.ai_summary).toBe('Project on track.')
  })

  it('truncates emails to 20 and body to 500 chars', async () => {
    const emails = Array.from({ length: 25 }, (_, i) => makeEmail({ body: 'x'.repeat(1000) }))
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ hot_topics: [], action_items: [], recent_decisions: [], next_steps: [], open_questions: [], key_data_points: [], ai_summary: 'ok' }) }],
    })

    await generateProjectStatusSnapshot(
      emails,
      makeFullContext({ project: { name: 'Test', address: '', phase: 'planning', currentStep: 1, totalSteps: 6, startDate: '', targetCompletion: '', squareFootage: null, style: '' }, budget: { total: 450000, spent: 0, remaining: 450000, items: [] } })
    )

    const callArgs = mockCreate.mock.calls[0][0]
    const prompt = callArgs.messages[0].content
    // Should not contain all 25 emails worth of body text
    const bodyOccurrences = (prompt.match(/x{500}/g) || []).length
    expect(bodyOccurrences).toBeLessThanOrEqual(20)
  })

  it('returns empty snapshot on error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('fail'))
    const result = await generateProjectStatusSnapshot(
      [],
      makeFullContext({ project: { name: 'Test', address: '', phase: 'planning', currentStep: 1, totalSteps: 6, startDate: '', targetCompletion: '', squareFootage: null, style: '' }, budget: { total: 450000, spent: 0, remaining: 450000, items: [] } })
    )
    expect(result.hot_topics).toEqual([])
    expect(result.next_steps).toEqual([])
    expect(result.open_questions).toEqual([])
    expect(result.key_data_points).toEqual([])
    expect(result.ai_summary).toContain('Unable to generate')
  })

  it('includes previous status context in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ hot_topics: [], action_items: [], recent_decisions: [], next_steps: [], open_questions: [], key_data_points: [], ai_summary: 'updated' }) }],
    })

    await generateProjectStatusSnapshot(
      [makeEmail()],
      makeFullContext(),
      { hot_topics: [{ priority: 'high', text: 'Old topic' }], action_items: [], recent_decisions: [], ai_summary: 'Previous', date: '2026-01-14' }
    )

    const prompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(prompt).toContain('Old topic')
    expect(prompt).toContain('2026-01-14')
  })
})
