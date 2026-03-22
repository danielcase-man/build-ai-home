import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetTemplates,
  mockGetTemplateByName,
  mockRenderTemplate,
  mockUpsertTemplate,
  mockCreateDefaultTemplates,
} = vi.hoisted(() => ({
  mockGetTemplates: vi.fn(),
  mockGetTemplateByName: vi.fn(),
  mockRenderTemplate: vi.fn(),
  mockUpsertTemplate: vi.fn(),
  mockCreateDefaultTemplates: vi.fn(),
}))

vi.mock('@/lib/email-template-service', () => ({
  getTemplates: mockGetTemplates,
  getTemplateByName: mockGetTemplateByName,
  renderTemplate: mockRenderTemplate,
  upsertTemplate: mockUpsertTemplate,
  createDefaultTemplates: mockCreateDefaultTemplates,
}))

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

vi.mock('@/lib/project-service', () => ({
  getProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
}))

import { GET, POST } from './route'

describe('GET /api/email-templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all templates', async () => {
    const templates = [
      { id: 't-1', name: 'bid_request', subject_template: 'Bid Request: {{trade}}' },
      { id: 't-2', name: 'follow_up', subject_template: 'Follow Up: {{vendor}}' },
    ]
    mockGetTemplates.mockResolvedValueOnce(templates)

    const req = new NextRequest('http://localhost/api/email-templates')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.count).toBe(2)
    expect(json.data.templates).toEqual(templates)
  })

  it('returns single template by name', async () => {
    const template = { id: 't-1', name: 'bid_request', subject_template: 'Bid Request: {{trade}}' }
    mockGetTemplateByName.mockResolvedValueOnce(template)

    const req = new NextRequest('http://localhost/api/email-templates?name=bid_request')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.template).toEqual(template)
  })

  it('returns empty when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/email-templates')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.templates).toEqual([])
  })
})

describe('POST /api/email-templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seeds default templates', async () => {
    mockCreateDefaultTemplates.mockResolvedValueOnce(5)

    const req = new NextRequest('http://localhost/api/email-templates', {
      method: 'POST',
      body: JSON.stringify({ action: 'seed_defaults' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.seeded).toBe(5)
  })

  it('renders a template', async () => {
    const template = {
      id: 't-1',
      name: 'bid_request',
      subject_template: 'Bid Request: {{trade}}',
      body_template: 'Hello {{vendor}}, please provide a bid for {{trade}}.',
      variables: [{ name: 'trade', description: 'Trade' }, { name: 'vendor', description: 'Vendor' }],
    }
    mockGetTemplateByName.mockResolvedValueOnce(template)
    mockRenderTemplate.mockReturnValueOnce({
      subject: 'Bid Request: plumbing',
      body: 'Hello Delta, please provide a bid for plumbing.',
    })

    const req = new NextRequest('http://localhost/api/email-templates', {
      method: 'POST',
      body: JSON.stringify({
        action: 'render',
        template_name: 'bid_request',
        variables: { trade: 'plumbing', vendor: 'Delta' },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.subject).toBe('Bid Request: plumbing')
  })

  it('returns validation error for render without template_name', async () => {
    const req = new NextRequest('http://localhost/api/email-templates', {
      method: 'POST',
      body: JSON.stringify({ action: 'render' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns error when render template not found', async () => {
    mockGetTemplateByName.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/email-templates', {
      method: 'POST',
      body: JSON.stringify({ action: 'render', template_name: 'nonexistent' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('creates/updates a template', async () => {
    const created = {
      id: 't-new',
      name: 'custom',
      subject_template: 'Subject: {{topic}}',
      body_template: 'Body here',
      variables: [],
    }
    mockUpsertTemplate.mockResolvedValueOnce(created)

    const req = new NextRequest('http://localhost/api/email-templates', {
      method: 'POST',
      body: JSON.stringify({
        name: 'custom',
        subject_template: 'Subject: {{topic}}',
        body_template: 'Body here',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.template).toEqual(created)
  })

  it('returns validation error when missing required fields for create', async () => {
    const req = new NextRequest('http://localhost/api/email-templates', {
      method: 'POST',
      body: JSON.stringify({ name: 'partial' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns error when no project', async () => {
    const { getProject } = await import('@/lib/project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null as never)

    const req = new NextRequest('http://localhost/api/email-templates', {
      method: 'POST',
      body: JSON.stringify({ action: 'seed_defaults' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.success).toBe(false)
  })
})
