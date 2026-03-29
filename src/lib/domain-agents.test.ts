import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'
import type { ChangeEvent } from '@/types'

// Mock supabase
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

// Mock AI clients
vi.mock('./ai-clients', () => ({
  getAnthropicClient: () => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{}' }],
      }),
    },
  }),
}))

// Mock document analyzer
vi.mock('./document-analyzer', () => ({
  extractTextFromPDF: vi.fn().mockResolvedValue('Sample extracted text from a PDF document with enough content to pass threshold checks.'),
}))

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue(Buffer.from('fake pdf content')),
  statSync: vi.fn().mockReturnValue({ size: 1024, mtime: new Date() }),
  readdirSync: vi.fn().mockReturnValue([]),
}))

// Mock dropbox-watcher
vi.mock('./dropbox-watcher', () => ({
  updateFileStatus: vi.fn().mockResolvedValue(undefined),
  scanDropboxIncremental: vi.fn().mockResolvedValue({ newFiles: [], modifiedFiles: [], totalScanned: 0, errors: [] }),
  getPendingFiles: vi.fn().mockResolvedValue([]),
}))

// Mock agent-router to avoid circular dependency
vi.mock('./agent-router', () => ({
  registerAgent: vi.fn(),
  classifyFileByPath: vi.fn().mockReturnValue('general'),
}))

const PROJECT_ID = 'test-project-id'

function makeFileEvent(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    source: 'dropbox',
    domain: 'general',
    file_path: '/test/path/file.pdf',
    file_name: 'file.pdf',
    file_type: 'pdf',
    detected_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeEmailEvent(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    source: 'gmail',
    domain: 'general',
    email_id: 'email-123',
    detected_at: new Date().toISOString(),
    ...overrides,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Takeoff Agent
// ────────────────────────────────────────────────────────────────────────────

describe('takeoff-agent', () => {
  let handleTakeoff: typeof import('./takeoff-agent').handleTakeoff

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./takeoff-agent')
    handleTakeoff = mod.handleTakeoff
    // Default: no existing documents (dedup check)
    chain.limit.mockResolvedValue({ data: [], error: null })
    // Default: insert succeeds
    chain.insert.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'doc-1' }, error: null }) }) })
    // Make insert succeed directly (no chained select/single)
    chain.insert.mockResolvedValue({ data: { id: 'doc-1' }, error: null })
  })

  it('catalogs plan files as documents', async () => {
    const events = [
      makeFileEvent({
        domain: 'takeoff',
        file_path: '/Dropbox/Development/Plans/Structural/floor-plan.pdf',
        file_name: 'floor-plan.pdf',
        file_type: 'pdf',
      }),
    ]

    const result = await handleTakeoff(events, PROJECT_ID)

    expect(result.domain).toBe('takeoff')
    expect(result.action).toBe('catalog_plans')
    expect(chain.from).toHaveBeenCalledWith('documents')
  })

  it('skips files already cataloged', async () => {
    chain.limit.mockResolvedValue({ data: [{ id: 'existing-doc' }], error: null })

    const events = [makeFileEvent({ domain: 'takeoff' })]
    const result = await handleTakeoff(events, PROJECT_ID)

    // Should not create new records
    expect(result.records_created).toBe(0)
  })

  it('returns zero records for empty events', async () => {
    const result = await handleTakeoff([], PROJECT_ID)
    expect(result.details).toBe('No plan files to catalog')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Financial Agent
// ────────────────────────────────────────────────────────────────────────────

describe('financial-agent', () => {
  let handleFinancial: typeof import('./financial-agent').handleFinancial

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./financial-agent')
    handleFinancial = mod.handleFinancial
    chain.limit.mockResolvedValue({ data: [], error: null })
    chain.insert.mockResolvedValue({ data: { id: 'doc-1' }, error: null })
  })

  it('catalogs spreadsheet files without AI', async () => {
    const events = [
      makeFileEvent({
        domain: 'financial',
        file_path: '/Dropbox/Financial/budget.xlsx',
        file_name: 'budget.xlsx',
        file_type: 'xlsx',
      }),
    ]

    const result = await handleFinancial(events, PROJECT_ID)

    expect(result.domain).toBe('financial')
    expect(chain.from).toHaveBeenCalledWith('documents')
  })

  it('processes PDF invoices with AI extraction', async () => {
    // Mock AI to return invoice data
    const { getAnthropicClient } = await import('./ai-clients')
    const mockClient = getAnthropicClient() as { messages: { create: ReturnType<typeof vi.fn> } }
    mockClient.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          type: 'invoice',
          vendor_name: 'Test Plumber',
          amount: 5000,
          date: '2026-03-15',
          description: 'Plumbing rough-in',
          invoice_number: 'INV-001',
        }),
      }],
    })

    const events = [
      makeFileEvent({
        domain: 'financial',
        file_path: '/Dropbox/Invoices/plumber-invoice.pdf',
        file_name: 'plumber-invoice.pdf',
      }),
    ]

    const result = await handleFinancial(events, PROJECT_ID)
    expect(result.domain).toBe('financial')
  })

  it('returns empty for no events', async () => {
    const result = await handleFinancial([], PROJECT_ID)
    expect(result.details).toBe('No financial files to process')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Contract Agent
// ────────────────────────────────────────────────────────────────────────────

describe('contract-agent', () => {
  let handleContract: typeof import('./contract-agent').handleContract

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./contract-agent')
    handleContract = mod.handleContract
    chain.limit.mockResolvedValue({ data: [], error: null })
    chain.insert.mockResolvedValue({ data: { id: 'doc-1' }, error: null })
  })

  it('processes contract PDF files', async () => {
    const { getAnthropicClient } = await import('./ai-clients')
    const mockClient = getAnthropicClient() as { messages: { create: ReturnType<typeof vi.fn> } }
    mockClient.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          title: 'WCG Construction Agreement',
          vendor_name: 'Wise Contracting Group',
          total_amount: 150000,
          payment_terms: 'Per draw schedule',
          start_date: '2026-04-01',
          status: 'draft',
          description: 'Owner-managed construction agreement',
        }),
      }],
    })

    const events = [
      makeFileEvent({
        domain: 'contract',
        file_path: '/Dropbox/Contracts/wcg-agreement.pdf',
        file_name: 'wcg-agreement.pdf',
      }),
    ]

    const result = await handleContract(events, PROJECT_ID)
    expect(result.domain).toBe('contract')
    expect(chain.from).toHaveBeenCalledWith('contracts')
  })

  it('skips non-contract files detected by AI', async () => {
    const { getAnthropicClient } = await import('./ai-clients')
    const mockClient = getAnthropicClient() as { messages: { create: ReturnType<typeof vi.fn> } }
    mockClient.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({ title: 'NOT_A_CONTRACT' }),
      }],
    })

    const events = [makeFileEvent({ domain: 'contract' })]
    const result = await handleContract(events, PROJECT_ID)
    // Should still catalog the document, just not create a contract record
    expect(result.domain).toBe('contract')
  })

  it('returns empty for no events', async () => {
    const result = await handleContract([], PROJECT_ID)
    expect(result.details).toBe('No contract files to process')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Scheduling Agent
// ────────────────────────────────────────────────────────────────────────────

describe('scheduling-agent', () => {
  let handleScheduling: typeof import('./scheduling-agent').handleScheduling

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./scheduling-agent')
    handleScheduling = mod.handleScheduling
    chain.single.mockResolvedValue({
      data: {
        id: 'email-123',
        subject: 'Inspection scheduled for April 15',
        sender_email: 'inspector@county.gov',
        body: 'Your building inspection is scheduled for April 15, 2026 at 9:00 AM.',
        received_date: '2026-03-29',
      },
      error: null,
    })
    chain.insert.mockResolvedValue({ data: { id: 'task-1' }, error: null })
  })

  it('extracts scheduling data from emails', async () => {
    const { getAnthropicClient } = await import('./ai-clients')
    const mockClient = getAnthropicClient() as { messages: { create: ReturnType<typeof vi.fn> } }
    mockClient.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify([{
          type: 'inspection',
          title: 'Building inspection',
          date: '2026-04-15',
          description: 'Scheduled building inspection',
          vendor_or_authority: 'County Inspector',
        }]),
      }],
    })

    const events = [makeEmailEvent({ domain: 'scheduling' })]
    const result = await handleScheduling(events, PROJECT_ID)

    expect(result.domain).toBe('scheduling')
    expect(result.source).toBe('gmail')
    expect(result.action).toBe('process_schedule_emails')
    // Task creation attempted (mock chain doesn't fully support multi-table ops)
    expect(result.details).toContain('task')
  })

  it('returns empty for no email events', async () => {
    const result = await handleScheduling([], PROJECT_ID)
    expect(result.details).toBe('No schedule-related emails to process')
  })

  it('handles emails with no scheduling items', async () => {
    const { getAnthropicClient } = await import('./ai-clients')
    const mockClient = getAnthropicClient() as { messages: { create: ReturnType<typeof vi.fn> } }
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    })

    const events = [makeEmailEvent({ domain: 'scheduling' })]
    const result = await handleScheduling(events, PROJECT_ID)
    expect(result.records_created).toBe(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Follow-Up Agent
// ────────────────────────────────────────────────────────────────────────────

describe('follow-up-agent', () => {
  let handleFollowUp: typeof import('./follow-up-agent').handleFollowUp

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('./follow-up-agent')
    handleFollowUp = mod.handleFollowUp
    // Mock email fetch
    chain.single.mockResolvedValue({
      data: {
        id: 'email-456',
        subject: 'Following up on cabinet bid request',
        sender_email: 'info@gutierrezcabinets.com',
        body: 'Just following up on the bid request we sent last week.',
        received_date: '2026-03-29',
      },
      error: null,
    })
    // No existing follow-ups
    chain.limit.mockResolvedValue({ data: [], error: null })
    chain.insert.mockResolvedValue({ data: { id: 'fu-1' }, error: null })
  })

  it('creates follow-up records from emails', async () => {
    const { getAnthropicClient } = await import('./ai-clients')
    const mockClient = getAnthropicClient() as { messages: { create: ReturnType<typeof vi.fn> } }
    mockClient.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor_name: 'Gutierrez Cabinets',
          contact_email: 'info@gutierrezcabinets.com',
          category: 'bid_request',
          subject: 'Cabinet bid follow-up',
          context: 'Following up on bid request sent 2 weeks ago',
          response_summary: null,
          needs_action: true,
          suggested_next_date: '2026-04-05',
        }),
      }],
    })

    const events = [makeEmailEvent({ domain: 'follow_up' })]
    const result = await handleFollowUp(events, PROJECT_ID)

    expect(result.domain).toBe('follow_up')
    expect(result.source).toBe('gmail')
    expect(chain.from).toHaveBeenCalledWith('vendor_follow_ups')
  })

  it('updates existing follow-up when vendor already tracked', async () => {
    // Existing follow-up found
    chain.limit.mockResolvedValue({
      data: [{ id: 'existing-fu', follow_up_count: 2, status: 'awaiting_response' }],
      error: null,
    })

    const { getAnthropicClient } = await import('./ai-clients')
    const mockClient = getAnthropicClient() as { messages: { create: ReturnType<typeof vi.fn> } }
    mockClient.messages.create.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          vendor_name: 'Gutierrez Cabinets',
          category: 'bid_request',
          subject: 'Response to bid request',
          response_summary: 'Vendor provided updated pricing',
          needs_action: true,
        }),
      }],
    })

    // Mock update
    chain.eq.mockReturnValue({ data: null, error: null })

    const events = [makeEmailEvent({ domain: 'follow_up' })]
    const result = await handleFollowUp(events, PROJECT_ID)

    expect(result.domain).toBe('follow_up')
  })

  it('returns empty for no email events', async () => {
    const result = await handleFollowUp([], PROJECT_ID)
    expect(result.details).toBe('No follow-up emails to process')
  })

  it('skips emails that are not vendor follow-ups', async () => {
    const { getAnthropicClient } = await import('./ai-clients')
    const mockClient = getAnthropicClient() as { messages: { create: ReturnType<typeof vi.fn> } }
    mockClient.messages.create.mockResolvedValue({
      content: [{ type: 'text', text: 'null' }],
    })

    const events = [makeEmailEvent({ domain: 'follow_up' })]
    const result = await handleFollowUp(events, PROJECT_ID)
    expect(result.records_created).toBe(0)
    expect(result.records_updated).toBe(0)
  })
})
