import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock('@/lib/ai-clients', () => ({
  getAnthropicClient: () => ({ messages: { create: mockCreate } }),
  parseAIJsonResponse: (text: string) => {
    let t = text.trim()
    if (t.startsWith('```json')) t = t.replace(/^```json\n/, '').replace(/\n```$/, '')
    return JSON.parse(t)
  },
}))

import { POST } from './route'

describe('POST /api/emails/drafts/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns validation error when no context', async () => {
    const req = new NextRequest('http://localhost:3000/api/emails/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('generates a draft with id and status', async () => {
    const draft = { to: 'vendor@test.com', toName: 'Vendor', subject: 'Follow up', body: '<p>Hi</p>', reason: 'Need update', priority: 'high' }
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(draft) }] })

    const req = new NextRequest('http://localhost:3000/api/emails/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({ context: 'Follow up on bid', to: 'vendor@test.com', toName: 'Vendor' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.draft.id).toMatch(/^draft-/)
    expect(json.data.draft.status).toBe('draft')
  })

  it('handles AI failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API down'))
    const req = new NextRequest('http://localhost:3000/api/emails/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({ context: 'Follow up' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
