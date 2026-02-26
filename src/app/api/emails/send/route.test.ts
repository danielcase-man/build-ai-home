import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetAuthenticatedGmailService, mockSendEmail } = vi.hoisted(() => ({
  mockGetAuthenticatedGmailService: vi.fn(),
  mockSendEmail: vi.fn(),
}))

vi.mock('@/lib/gmail-auth', () => ({
  getAuthenticatedGmailService: mockGetAuthenticatedGmailService,
}))

import { POST } from './route'

describe('POST /api/emails/send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthenticatedGmailService.mockResolvedValue({
      sendEmail: mockSendEmail,
    })
  })

  it('returns validation error for missing fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/emails/send', {
      method: 'POST',
      body: JSON.stringify({ to: 'test@test.com' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('sends email successfully', async () => {
    mockSendEmail.mockResolvedValueOnce('msg-id-123')
    const req = new NextRequest('http://localhost:3000/api/emails/send', {
      method: 'POST',
      body: JSON.stringify({ to: 'vendor@test.com', subject: 'Hello', body: '<p>Test</p>' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.messageId).toBe('msg-id-123')
  })

  it('returns 401 when Gmail not connected', async () => {
    mockGetAuthenticatedGmailService.mockResolvedValueOnce(null)
    const req = new NextRequest('http://localhost:3000/api/emails/send', {
      method: 'POST',
      body: JSON.stringify({ to: 'a@b.com', subject: 'Hi', body: '<p>x</p>' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns error when send fails', async () => {
    mockSendEmail.mockResolvedValueOnce(null)
    const req = new NextRequest('http://localhost:3000/api/emails/send', {
      method: 'POST',
      body: JSON.stringify({ to: 'a@b.com', subject: 'Hi', body: '<p>x</p>' }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
