import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'

// Mock supabase (inline to avoid hoisting issues)
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

// Mock AI clients
vi.mock('./ai-clients', () => ({
  getAnthropicClient: () => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }] }) },
  }),
  parseAIJsonResponse: (text: string) => JSON.parse(text),
}))

// Mock document-analyzer
vi.mock('./document-analyzer', () => ({
  extractTextFromPDF: vi.fn().mockResolvedValue('test text'),
}))

// Mock bid-documents-service
vi.mock('./bid-documents-service', () => ({
  createBidDocument: vi.fn().mockResolvedValue({ id: 'doc-001' }),
  updateExtractionStatus: vi.fn().mockResolvedValue(undefined),
}))

// Mock bid-line-items-service
vi.mock('./bid-line-items-service', () => ({
  createLineItemsFromExtraction: vi.fn().mockResolvedValue([]),
}))

// Mock vendor-name-utils — we test the real logic here
// but we need to let it through
vi.mock('./vendor-name-utils', async () => {
  const actual = await vi.importActual('./vendor-name-utils')
  return actual
})

import { findOrCreateVendor, createBidWithLineItems } from './bid-ingestion-service'
import type { ExtractedBidV2 } from '@/types'

describe('findOrCreateVendor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for empty vendor name', async () => {
    const result = await findOrCreateVendor('proj-1', '')
    expect(result).toBeNull()
  })

  it('returns null for whitespace-only vendor name', async () => {
    const result = await findOrCreateVendor('proj-1', '   ')
    expect(result).toBeNull()
  })

  it('matches an existing vendor by exact name', async () => {
    // Mock: vendors query returns one vendor
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ id: 'vendor-abc', company_name: 'ABC Cabinets' }],
        error: null,
      }),
      writable: true,
      configurable: true,
    })

    const result = await findOrCreateVendor('proj-1', 'ABC Cabinets')
    expect(result).toBe('vendor-abc')
  })

  it('matches an existing vendor by fuzzy name (subset tokens)', async () => {
    // "FBS" should match "FBS Appliances" via token containment
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ id: 'vendor-fbs', company_name: 'FBS Appliances' }],
        error: null,
      }),
      writable: true,
      configurable: true,
    })

    const result = await findOrCreateVendor('proj-1', 'FBS')
    expect(result).toBe('vendor-fbs')
  })

  it('matches vendor with different word order', async () => {
    // "Appliances FBS" should match "FBS Appliances" via tokenSortRatio
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ id: 'vendor-fbs', company_name: 'FBS Appliances' }],
        error: null,
      }),
      writable: true,
      configurable: true,
    })

    const result = await findOrCreateVendor('proj-1', 'Appliances FBS')
    expect(result).toBe('vendor-fbs')
  })

  it('matches vendor with parenthetical content stripped', async () => {
    // "Supplier ProSource (Austin)" should match "ProSource" via normalization
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ id: 'vendor-ps', company_name: 'ProSource' }],
        error: null,
      }),
      writable: true,
      configurable: true,
    })

    const result = await findOrCreateVendor('proj-1', 'Supplier ProSource (Austin)')
    expect(result).toBe('vendor-ps')
  })

  it('creates a new vendor when no match found', async () => {
    // First call: vendors query returns empty
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [],
        error: null,
      }),
      writable: true,
      configurable: true,
    })
    // Second call: insert returns new vendor
    chain.single.mockResolvedValueOnce({ data: { id: 'vendor-new-123' }, error: null })

    const result = await findOrCreateVendor('proj-1', 'Brand New Vendor LLC', {
      contact: 'John',
      category: 'Roofing',
    })
    expect(result).toBe('vendor-new-123')
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 'proj-1',
      company_name: 'Brand New Vendor LLC',
      primary_contact: 'John',
      category: 'Roofing',
      status: 'active',
    }))
  })

  it('returns null when vendor creation fails', async () => {
    // Vendors query returns empty
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [],
        error: null,
      }),
      writable: true,
      configurable: true,
    })
    // Insert fails
    chain.single.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })

    const result = await findOrCreateVendor('proj-1', 'Failing Vendor')
    expect(result).toBeNull()
  })

  it('does not match completely different vendor names', async () => {
    // "Acme Roofing" should NOT match "Zenith Plumbing"
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ id: 'vendor-zen', company_name: 'Zenith Plumbing' }],
        error: null,
      }),
      writable: true,
      configurable: true,
    })
    // Will fall through to vendor creation
    chain.single.mockResolvedValueOnce({ data: { id: 'vendor-acme' }, error: null })

    const result = await findOrCreateVendor('proj-1', 'Acme Roofing')
    // Should create new, not return the Zenith vendor
    expect(result).toBe('vendor-acme')
    expect(chain.insert).toHaveBeenCalled()
  })
})

describe('createBidWithLineItems vendor linking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets vendor_id on the bid when vendor is found', async () => {
    const extracted: ExtractedBidV2 = {
      vendor_name: 'Test Cabinets Inc',
      category: 'Cabinetry',
      description: 'Kitchen cabinets',
      total_amount: 25000,
      ai_confidence: 0.9,
      ai_extraction_notes: '',
      line_items_v2: [],
    }

    // Mock: vendors query returns match
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ id: 'vendor-match-1', company_name: 'Test Cabinets Inc' }],
        error: null,
      }),
      writable: true,
      configurable: true,
    })
    // Bid insert
    chain.single.mockResolvedValueOnce({ data: { id: 'bid-001' }, error: null })

    const result = await createBidWithLineItems('proj-1', extracted)

    expect(result).not.toBeNull()
    expect(result?.bidId).toBe('bid-001')
    // Verify vendor_id was passed in the insert
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ vendor_id: 'vendor-match-1' })
    )
  })

  it('creates a new vendor and sets vendor_id when no match', async () => {
    const extracted: ExtractedBidV2 = {
      vendor_name: 'Totally New Co',
      category: 'Roofing',
      description: 'Roof bid',
      total_amount: 50000,
      ai_confidence: 0.88,
      ai_extraction_notes: '',
      line_items_v2: [],
    }

    // Mock: vendors query returns empty
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [],
        error: null,
      }),
      writable: true,
      configurable: true,
    })
    // First single: vendor creation
    chain.single.mockResolvedValueOnce({ data: { id: 'vendor-new-99' }, error: null })
    // Second single: bid insert
    chain.single.mockResolvedValueOnce({ data: { id: 'bid-002' }, error: null })

    const result = await createBidWithLineItems('proj-1', extracted)

    expect(result).not.toBeNull()
    expect(result?.bidId).toBe('bid-002')
    // Should have inserted vendor, then bid with that vendor_id
    const insertCalls = chain.insert.mock.calls
    expect(insertCalls[0][0]).toEqual(expect.objectContaining({
      company_name: 'Totally New Co',
    }))
    expect(insertCalls[1][0]).toEqual(expect.objectContaining({
      vendor_id: 'vendor-new-99',
    }))
  })
})
