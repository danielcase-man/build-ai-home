import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeExtractedBid } from '@/test/helpers'

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

import { extractBidFromEmail, extractBidFromDocument, refineBidExtraction, compareBids } from './bid-extractor'

describe('extractBidFromEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('extracts bids from email content', async () => {
    const bid = makeExtractedBid()
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ bids: [bid] }) }],
    })

    const result = await extractBidFromEmail('Quote', 'Here is the quote...', 'vendor@test.com', 'Vendor')
    expect(result.success).toBe(true)
    expect(result.bids).toHaveLength(1)
    expect(result.bids[0].vendor_name).toBe('Acme Construction')
  })

  it('returns empty bids for non-bid email', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ bids: [] }) }],
    })

    const result = await extractBidFromEmail('Meeting notes', 'Just a quick update...', 'team@test.com')
    expect(result.success).toBe(true)
    expect(result.bids).toEqual([])
  })

  it('handles API error gracefully', async () => {
    mockCreate.mockRejectedValueOnce(new Error('rate limit'))

    const result = await extractBidFromEmail('Quote', 'Body', 'v@test.com')
    expect(result.success).toBe(false)
    expect(result.bids).toEqual([])
    expect(result.error).toBe('rate limit')
  })

  it('handles unexpected response format', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'image', source: {} }],
    })

    const result = await extractBidFromEmail('Quote', 'Body', 'v@test.com')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unexpected response format')
  })
})

describe('extractBidFromDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('extracts bids from document text', async () => {
    const bid = makeExtractedBid({ category: 'Windows & Doors' })
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ bids: [bid] }) }],
    })

    const result = await extractBidFromDocument('Window quote...', 'Window Co', 'quote.pdf')
    expect(result.success).toBe(true)
    expect(result.bids[0].category).toBe('Windows & Doors')
  })

  it('returns failure on error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('fail'))
    const result = await extractBidFromDocument('text')
    expect(result.success).toBe(false)
  })
})

describe('refineBidExtraction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refines bid with additional context', async () => {
    const refined = makeExtractedBid({ total_amount: 90000 })
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({ bids: [refined] }) }],
    })

    const original = makeExtractedBid()
    const result = await refineBidExtraction(original, 'Updated price is $90K')
    expect(result.success).toBe(true)
    expect(result.bids[0].total_amount).toBe(90000)
  })

  it('handles single bid response (no bids wrapper)', async () => {
    const refined = makeExtractedBid({ total_amount: 95000 })
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(refined) }],
    })

    const result = await refineBidExtraction(makeExtractedBid(), 'context')
    expect(result.success).toBe(true)
    expect(result.bids).toHaveLength(1)
  })

  it('handles error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('oops'))
    const result = await refineBidExtraction(makeExtractedBid(), 'context')
    expect(result.success).toBe(false)
  })
})

describe('compareBids', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns comparison analysis', async () => {
    const comparison = {
      comparison: 'Bid A is lower cost but less scope.',
      recommendation: 'Choose Bid A for budget savings.',
      pros_cons: [
        { bid_id: 0, vendor: 'A', pros: ['Low cost'], cons: ['Less scope'] },
        { bid_id: 1, vendor: 'B', pros: ['Full scope'], cons: ['Higher cost'] },
      ],
    }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(comparison) }],
    })

    const result = await compareBids([
      makeExtractedBid({ vendor_name: 'A', total_amount: 80000 }),
      makeExtractedBid({ vendor_name: 'B', total_amount: 95000 }),
    ])
    expect(result.comparison).toContain('Bid A')
    expect(result.pros_cons).toHaveLength(2)
  })

  it('returns error message on failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API down'))
    const result = await compareBids([makeExtractedBid()])
    expect(result.comparison).toContain('Error')
    expect(result.pros_cons).toEqual([])
  })
})
