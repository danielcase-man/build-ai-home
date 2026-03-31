/**
 * Shared test helpers — mock factories and data builders
 */
import { vi } from 'vitest'
import type { Email, EmailRecord, EmailThread, ThreadedEmail, Bid, Selection, ExtractedBid } from '@/types'

// ─── Chainable Supabase Mock ────────────────────────────────────────────────

type SupabaseChain = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
}

export function createMockSupabase(resolveWith: { data?: unknown; error?: unknown; count?: number } = {}) {
  const result = { data: resolveWith.data ?? null, error: resolveWith.error ?? null, count: resolveWith.count ?? null }

  const chain: SupabaseChain = {} as SupabaseChain

  // Every chainable method returns the chain itself
  for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt', 'order', 'limit', 'like', 'ilike', 'not', 'is', 'or', 'range', 'match', 'contains', 'containedBy', 'filter', 'textSearch'] as const) {
    (chain as Record<string, ReturnType<typeof vi.fn>>)[method] = vi.fn().mockReturnValue(chain)
  }

  // Terminal method resolves the promise
  chain.single = vi.fn().mockResolvedValue(result)

  // Override the chain itself to act as a thenable (for queries without .single())
  // This makes `await query` work
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve(result),
    writable: true,
    configurable: true,
  })

  chain.from = vi.fn().mockReturnValue(chain)

  return { supabase: chain, chain, result }
}

// ─── Anthropic Mock ─────────────────────────────────────────────────────────

export function mockAnthropicResponse(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
  }
}

export function createMockAnthropicClient(responseText = '{}') {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(mockAnthropicResponse(responseText)),
    },
  }
}

// ─── Data Factories ─────────────────────────────────────────────────────────

export function makeEmail(overrides: Partial<Email> = {}): Email {
  return {
    subject: 'Foundation bid update',
    from: 'vendor@example.com',
    body: 'Please find the updated bid attached.',
    date: '2026-01-15',
    ...overrides,
  }
}

export function makeThreadedEmail(overrides: Partial<ThreadedEmail> = {}): ThreadedEmail {
  return {
    subject: 'Foundation bid update',
    from: 'vendor@example.com',
    body: 'Please find the updated bid attached.',
    date: '2026-01-15',
    threadId: 'thread-001',
    direction: 'received',
    ...overrides,
  }
}

export function makeEmailThread(overrides: Partial<EmailThread> = {}): EmailThread {
  const messages = overrides.messages || [makeThreadedEmail()]
  return {
    threadId: 'thread-001',
    subject: messages[0].subject,
    participants: [...new Set(messages.map(m => m.from))],
    messages,
    lastMessageDate: messages[messages.length - 1].date,
    danielReplied: messages.some(m => m.direction === 'sent'),
    ...overrides,
  }
}

export function makeEmailRecord(overrides: Partial<EmailRecord> = {}): EmailRecord {
  return {
    id: 'email-001',
    project_id: 'proj-001',
    message_id: `msg-${Date.now()}`,
    sender_email: 'vendor@example.com',
    sender_name: 'Test Vendor',
    subject: 'Quote for framing',
    body_text: 'Attached is our quote for the framing package.',
    received_date: '2026-01-20T10:00:00Z',
    is_read: false,
    ...overrides,
  }
}

export function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: 'bid-001',
    vendor_name: 'Acme Construction',
    category: 'Foundation',
    description: 'Full foundation pour',
    total_amount: 85000,
    status: 'pending',
    ai_extracted: true,
    ai_confidence: 0.92,
    needs_review: false,
    bid_date: '2026-01-10',
    received_date: '2026-01-10',
    ...overrides,
  }
}

export function makeExtractedBid(overrides: Partial<ExtractedBid> = {}): ExtractedBid {
  return {
    vendor_name: 'Acme Construction',
    category: 'Foundation',
    description: 'Foundation pour including pad prep',
    total_amount: 85000,
    ai_confidence: 0.95,
    ai_extraction_notes: 'Extracted from email body',
    ...overrides,
  }
}

export function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-001',
    name: 'Purple Salvia Cove',
    address: '708 Purple Salvia Cove, Liberty Hill, TX',
    phase: 'planning',
    budget_total: '450000',
    estimated_duration_days: 117,
    created_at: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

export function makeSelection(overrides: Partial<Selection> = {}): Selection {
  return {
    id: 'sel-001',
    project_id: 'proj-001',
    room: 'Primary Bathroom',
    category: 'plumbing',
    product_name: 'Delta Faucet',
    quantity: 1,
    status: 'considering',
    ...overrides,
  }
}

// ─── NextRequest mock ───────────────────────────────────────────────────────

export function createMockRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
    searchParams?: Record<string, string>
  } = {}
) {
  const { method = 'GET', body, headers = {}, searchParams = {} } = options
  const urlObj = new URL(url, 'http://localhost:3000')
  for (const [key, value] of Object.entries(searchParams)) {
    urlObj.searchParams.set(key, value)
  }

  return new Request(urlObj.toString(), {
    method,
    headers: new Headers(headers),
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
