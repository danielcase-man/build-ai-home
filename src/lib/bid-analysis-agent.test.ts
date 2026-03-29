import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase, createMockAnthropicClient } from '@/test/helpers'
import type { ChangeEvent } from '@/types'

// Mock supabase (create inline to avoid hoisting issues)
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

// Mock AI clients
const mockAI = createMockAnthropicClient(JSON.stringify({
  vendor_name: 'Test Vendor',
  category: 'Cabinetry',
  description: 'Kitchen cabinets bid',
  total_amount: 45000,
  ai_confidence: 0.92,
  ai_extraction_notes: 'Clean extraction',
  line_items_v2: [
    { item_name: 'Upper Cabinets', quantity: 12, unit: 'each', total_price: 18000 },
    { item_name: 'Lower Cabinets', quantity: 15, unit: 'each', total_price: 27000 },
  ],
}))
vi.mock('./ai-clients', () => ({
  getAnthropicClient: () => mockAI,
  parseAIJsonResponse: (text: string) => JSON.parse(text),
}))

// Mock document analyzer
vi.mock('./document-analyzer', () => ({
  extractTextFromPDF: vi.fn().mockResolvedValue('This is a bid from Test Vendor for kitchen cabinets...'),
}))

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue(Buffer.from('fake pdf content')),
}))

// Mock dropbox-watcher
vi.mock('./dropbox-watcher', () => ({
  updateFileStatus: vi.fn().mockResolvedValue(undefined),
}))

// Mock bid-documents-service
vi.mock('./bid-documents-service', () => ({
  createBidDocument: vi.fn().mockResolvedValue({ id: 'doc-001' }),
  updateExtractionStatus: vi.fn().mockResolvedValue(undefined),
}))

// Mock bid-line-items-service
vi.mock('./bid-line-items-service', () => ({
  createLineItemsFromExtraction: vi.fn().mockResolvedValue([{ id: 'li-1' }, { id: 'li-2' }]),
}))

// Mock agent-router to avoid circular dependency
vi.mock('./agent-router', () => ({
  registerAgent: vi.fn(),
  classifyFileByPath: vi.fn().mockReturnValue('bid_analysis'),
}))

import { handleBidAnalysis } from './bid-analysis-agent'

describe('bid-analysis-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock: no existing bid documents (dedup check)
    chain.single.mockResolvedValue({ data: null, error: null })

    // Default: limit returns no existing data
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      writable: true,
      configurable: true,
    })
  })

  it('processes PDF bid files and creates records', async () => {
    // Mock bid creation success
    chain.single.mockResolvedValueOnce({ data: [], error: null }) // dedup check - no existing
    chain.single.mockResolvedValueOnce({ data: null, error: null }) // vendor lookup
    chain.single.mockResolvedValueOnce({ data: { id: 'bid-new-001' }, error: null }) // bid insert

    const events: ChangeEvent[] = [{
      source: 'dropbox',
      domain: 'bid_analysis',
      file_path: 'C:/Users/danie/Dropbox/Bids/Cabinets/quote.pdf',
      file_name: 'quote.pdf',
      file_type: 'pdf',
      detected_at: '2026-03-29T10:00:00Z',
    }]

    const result = await handleBidAnalysis(events, 'proj-001')

    expect(result.domain).toBe('bid_analysis')
    expect(result.action).toBe('process_bids')
  })

  it('skips non-processable file types', async () => {
    const events: ChangeEvent[] = [{
      source: 'dropbox',
      domain: 'bid_analysis',
      file_path: '/Bids/photo.xlsx',
      file_name: 'photo.xlsx',
      file_type: 'xlsx',
      detected_at: '2026-03-29T10:00:00Z',
    }]

    const result = await handleBidAnalysis(events, 'proj-001')
    expect(result.details).toContain('No processable bid files')
  })

  it('returns empty result for no events', async () => {
    const result = await handleBidAnalysis([], 'proj-001')
    expect(result.details).toContain('No processable bid files')
    expect(result.records_created).toBe(0)
  })

  it('limits to MAX_PER_RUN files', async () => {
    // Create 25 events (more than MAX_PER_RUN=20)
    const events: ChangeEvent[] = Array.from({ length: 25 }, (_, i) => ({
      source: 'dropbox' as const,
      domain: 'bid_analysis' as const,
      file_path: `/Bids/file${i}.pdf`,
      file_name: `file${i}.pdf`,
      file_type: 'pdf',
      detected_at: '2026-03-29T10:00:00Z',
    }))

    // Mock all necessary responses
    for (let i = 0; i < 25; i++) {
      chain.single.mockResolvedValueOnce({ data: [], error: null })
    }

    const result = await handleBidAnalysis(events, 'proj-001')
    // Should have processed at most 20 files
    expect(result.domain).toBe('bid_analysis')
  })
})
