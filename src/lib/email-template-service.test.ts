import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ──────────────────────────────────────────────────────────
const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'order', 'limit', 'single', 'from'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

import {
  getTemplates,
  getTemplateByName,
  renderTemplate,
  upsertTemplate,
  createDefaultTemplates,
} from './email-template-service'
import type { EmailTemplate } from './email-template-service'

function mockSequentialResponses(responses: Array<{ data?: unknown; error?: unknown }>) {
  let callCount = 0
  Object.defineProperty(mockChain, 'then', {
    value: (resolve: (v: unknown) => void) => {
      const resp = responses[callCount] || responses[responses.length - 1]
      callCount++
      resolve({ data: resp.data ?? null, error: resp.error ?? null })
    },
    writable: true,
    configurable: true,
  })
}

describe('Email Template Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  describe('renderTemplate', () => {
    it('replaces variables in subject and body', () => {
      const template: EmailTemplate = {
        project_id: 'proj-001',
        name: 'test',
        subject_template: 'Bid for {{category}}',
        body_template: '<p>Hi {{vendor_name}}, regarding {{category}}</p>',
        variables: [
          { name: 'category', description: 'Category' },
          { name: 'vendor_name', description: 'Vendor' },
        ],
      }

      const result = renderTemplate(template, {
        category: 'Framing',
        vendor_name: 'Bob',
      })

      expect(result.subject).toBe('Bid for Framing')
      expect(result.body).toBe('<p>Hi Bob, regarding Framing</p>')
    })

    it('uses default values when variables not provided', () => {
      const template: EmailTemplate = {
        project_id: 'proj-001',
        name: 'test',
        subject_template: '{{greeting}} {{name}}',
        body_template: '{{notes}}',
        variables: [
          { name: 'greeting', description: 'Greeting', default: 'Hello' },
          { name: 'name', description: 'Name' },
          { name: 'notes', description: 'Notes', default: 'No notes' },
        ],
      }

      const result = renderTemplate(template, { name: 'Alice' })
      expect(result.subject).toBe('Hello Alice')
      expect(result.body).toBe('No notes')
    })

    it('replaces multiple occurrences of the same variable', () => {
      const template: EmailTemplate = {
        project_id: 'proj-001',
        name: 'test',
        subject_template: '{{x}} and {{x}}',
        body_template: '{{x}}',
        variables: [{ name: 'x', description: 'X' }],
      }

      const result = renderTemplate(template, { x: 'VALUE' })
      expect(result.subject).toBe('VALUE and VALUE')
    })
  })

  describe('getTemplates', () => {
    it('fetches templates for a project', async () => {
      const templates = [
        { id: 't1', name: 'bid_request', subject_template: 'Bid' },
        { id: 't2', name: 'follow_up', subject_template: 'Follow up' },
      ]
      mockSequentialResponses([{ data: templates }])

      const result = await getTemplates('proj-001')
      expect(result).toHaveLength(2)
      expect(mockChain.eq).toHaveBeenCalledWith('project_id', 'proj-001')
    })
  })

  describe('getTemplateByName', () => {
    it('fetches a specific template', async () => {
      const template = { id: 't1', name: 'bid_request' }
      mockChain.single.mockResolvedValueOnce({ data: template, error: null })

      const result = await getTemplateByName('proj-001', 'bid_request')
      expect(result?.name).toBe('bid_request')
    })
  })

  describe('upsertTemplate', () => {
    it('creates or updates a template', async () => {
      const template: EmailTemplate = {
        project_id: 'proj-001',
        name: 'custom',
        subject_template: 'Custom {{name}}',
        body_template: '<p>Hi</p>',
        variables: [{ name: 'name', description: 'Name' }],
      }
      mockChain.single.mockResolvedValueOnce({ data: { ...template, id: 't-new' }, error: null })

      const result = await upsertTemplate(template)
      expect(result).toBeDefined()
      expect(mockChain.upsert).toHaveBeenCalled()
    })
  })

  describe('createDefaultTemplates', () => {
    it('seeds 4 default templates', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 't-1' }, error: null })

      const count = await createDefaultTemplates('proj-001')
      expect(count).toBe(4) // bid_request, bid_follow_up, schedule_confirmation, thank_you_bid
    })
  })
})
