import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateLinkToken, mockGetProject } = vi.hoisted(() => ({
  mockCreateLinkToken: vi.fn(),
  mockGetProject: vi.fn(),
}))

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

vi.mock('@/lib/plaid-client', () => ({
  createLinkToken: mockCreateLinkToken,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: mockGetProject,
}))

import { POST } from './route'

describe('POST /api/plaid/link-token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProject.mockResolvedValue({ id: 'proj-1' })
  })

  it('generates a link token', async () => {
    mockCreateLinkToken.mockResolvedValueOnce('link-sandbox-abc123')

    const res = await POST()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.link_token).toBe('link-sandbox-abc123')
    expect(mockCreateLinkToken).toHaveBeenCalledWith('proj-1')
  })

  it('returns error when no project found', async () => {
    mockGetProject.mockResolvedValueOnce(null)

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns error when createLinkToken throws', async () => {
    mockCreateLinkToken.mockRejectedValueOnce(new Error('Plaid API error'))

    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
