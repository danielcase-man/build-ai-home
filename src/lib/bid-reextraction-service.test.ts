import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'

// Mock supabase (inline to avoid hoisting issues)
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

// Mock bid-line-items-service
const mockCreateLineItems = vi.fn()
const mockDeleteLineItems = vi.fn()
vi.mock('./bid-line-items-service', () => ({
  createLineItemsFromExtraction: (...args: unknown[]) => mockCreateLineItems(...args),
  deleteLineItemsForBid: (...args: unknown[]) => mockDeleteLineItems(...args),
}))

// Mock bid-ingestion-service
const mockExtractBidV2 = vi.fn()
vi.mock('./bid-ingestion-service', () => ({
  extractBidV2FromText: (...args: unknown[]) => mockExtractBidV2(...args),
}))

// Mock document-analyzer
const mockExtractText = vi.fn()
vi.mock('./document-analyzer', () => ({
  extractTextFromPDF: (...args: unknown[]) => mockExtractText(...args),
}))

// Mock fs
const mockReadFile = vi.fn()
vi.mock('fs', () => ({
  readFileSync: (...args: unknown[]) => mockReadFile(...args),
}))

import { normalizeExistingLineItems, reextractBid, reextractAllBids } from './bid-reextraction-service'

describe('bid-reextraction-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateLineItems.mockResolvedValue([{ id: 'li-1' }])
    mockDeleteLineItems.mockResolvedValue(undefined)
    mockExtractText.mockResolvedValue('Full bid text from vendor with detailed line items and pricing.')
    mockReadFile.mockReturnValue(Buffer.from('fake pdf'))
    mockExtractBidV2.mockResolvedValue({
      bid: {
        vendor_name: 'Test Vendor',
        category: 'Cabinetry',
        description: 'Cabinets bid',
        total_amount: 50000,
        ai_confidence: 0.9,
        ai_extraction_notes: '',
        line_items_v2: [
          { item_name: 'Upper Cabinets', quantity: 12, unit: 'each', total_price: 24000 },
          { item_name: 'Lower Cabinets', quantity: 10, unit: 'each', total_price: 26000 },
        ],
      },
    })
  })

  // ─── normalizeExistingLineItems ─────────────────────────────────────────

  describe('normalizeExistingLineItems', () => {
    it('converts v1 JSONB to bid_line_items for bids that need it', async () => {
      // Mock: 2 bids with JSONB line_items
      const bidsWithJsonb = [
        {
          id: 'bid-001',
          category: 'Foundation',
          vendor_name: 'Vendor A',
          line_items: [
            { item: 'Slab pour', quantity: 1, total: 40000, specs: '4" thick' },
            { item: 'Rebar', quantity: 200, unit_price: 5, total: 1000 },
          ],
        },
        {
          id: 'bid-002',
          category: 'Framing',
          vendor_name: 'Vendor B',
          line_items: [
            { item: 'Wall framing', total: 30000 },
          ],
        },
      ]

      // First query: bids with line_items JSONB
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: bidsWithJsonb, error: null }),
        writable: true,
        configurable: true,
      })

      // Second query: existing bid_line_items (none)
      // The chain mock handles both queries via the same thenable.
      // We need to switch after first call.
      let callCount = 0
      Object.defineProperty(chain, 'then', {
        get() {
          return (resolve: (v: unknown) => void) => {
            callCount++
            if (callCount === 1) {
              resolve({ data: bidsWithJsonb, error: null })
            } else {
              resolve({ data: [], error: null }) // no existing line items
            }
          }
        },
        configurable: true,
      })

      mockCreateLineItems
        .mockResolvedValueOnce([{ id: 'li-1' }, { id: 'li-2' }]) // bid-001: 2 items
        .mockResolvedValueOnce([{ id: 'li-3' }]) // bid-002: 1 item

      const result = await normalizeExistingLineItems('proj-001')

      expect(result.normalized).toBe(2)
      expect(result.skipped).toBe(0)
      expect(result.errors).toHaveLength(0)

      // Verify createLineItemsFromExtraction was called with mapped data
      expect(mockCreateLineItems).toHaveBeenCalledTimes(2)

      // First bid mapping check
      const firstCall = mockCreateLineItems.mock.calls[0]
      expect(firstCall[0]).toBe('bid-001') // bid_id
      expect(firstCall[1]).toHaveLength(2) // 2 line items
      expect(firstCall[1][0].item_name).toBe('Slab pour')
      expect(firstCall[1][0].total_price).toBe(40000)
      expect(firstCall[1][0].unit).toBe('EA')
      expect(firstCall[1][0].category).toBe('Foundation')
      expect(firstCall[2]).toBe('Foundation') // bid category

      // Second bid mapping check
      const secondCall = mockCreateLineItems.mock.calls[1]
      expect(secondCall[0]).toBe('bid-002')
      expect(secondCall[1]).toHaveLength(1)
      expect(secondCall[1][0].item_name).toBe('Wall framing')
    })

    it('skips bids that already have line items', async () => {
      const bidsWithJsonb = [
        {
          id: 'bid-001',
          category: 'Foundation',
          vendor_name: 'Vendor A',
          line_items: [{ item: 'Slab pour', total: 40000 }],
        },
        {
          id: 'bid-002',
          category: 'Framing',
          vendor_name: 'Vendor B',
          line_items: [{ item: 'Wall framing', total: 30000 }],
        },
      ]

      let callCount = 0
      Object.defineProperty(chain, 'then', {
        get() {
          return (resolve: (v: unknown) => void) => {
            callCount++
            if (callCount === 1) {
              resolve({ data: bidsWithJsonb, error: null })
            } else {
              // bid-001 already has line items
              resolve({ data: [{ bid_id: 'bid-001' }], error: null })
            }
          }
        },
        configurable: true,
      })

      mockCreateLineItems.mockResolvedValueOnce([{ id: 'li-1' }])

      const result = await normalizeExistingLineItems('proj-001')

      expect(result.normalized).toBe(1) // only bid-002
      expect(result.skipped).toBe(1) // bid-001 skipped
      expect(mockCreateLineItems).toHaveBeenCalledTimes(1)
      expect(mockCreateLineItems.mock.calls[0][0]).toBe('bid-002')
    })
  })

  // ─── reextractBid ───────────────────────────────────────────────────────

  describe('reextractBid', () => {
    it('reads PDF, extracts, and creates line items', async () => {
      // bid lookup
      chain.single.mockResolvedValueOnce({
        data: { id: 'bid-001', category: 'Cabinetry', vendor_name: 'TestCo', project_id: 'proj-001' },
        error: null,
      })

      // bid_documents lookup (found a document with dropbox_path)
      Object.defineProperty(chain, 'then', {
        get() {
          return (resolve: (v: unknown) => void) => {
            resolve({ data: [{ dropbox_path: '/bids/TestCo/quote.pdf', storage_path: null }], error: null })
          }
        },
        configurable: true,
      })

      mockCreateLineItems.mockResolvedValueOnce([{ id: 'li-1' }, { id: 'li-2' }])

      const result = await reextractBid('bid-001')

      expect(result.lineItems).toBe(2)
      expect(result.error).toBeUndefined()
      expect(mockDeleteLineItems).toHaveBeenCalledWith('bid-001')
      expect(mockCreateLineItems).toHaveBeenCalledWith(
        'bid-001',
        expect.any(Array),
        'Cabinetry'
      )
      expect(mockReadFile).toHaveBeenCalledWith('/bids/TestCo/quote.pdf')
      expect(mockExtractText).toHaveBeenCalled()
      expect(mockExtractBidV2).toHaveBeenCalled()
    })

    it('returns error when no document found', async () => {
      // bid lookup
      chain.single.mockResolvedValueOnce({
        data: { id: 'bid-001', category: 'Cabinetry', vendor_name: 'TestCo', project_id: 'proj-001' },
        error: null,
      })

      // bid_documents lookup: empty
      // file_inventory lookup: also empty
      Object.defineProperty(chain, 'then', {
        get() {
          return (resolve: (v: unknown) => void) => {
            resolve({ data: [], error: null })
          }
        },
        configurable: true,
      })

      const result = await reextractBid('bid-001')

      expect(result.lineItems).toBe(0)
      expect(result.error).toBe('No document found for this bid')
      expect(mockReadFile).not.toHaveBeenCalled()
    })
  })

  // ─── reextractAllBids ───────────────────────────────────────────────────

  describe('reextractAllBids', () => {
    it('processes bids in batches with concurrency limit', async () => {
      // First query: all bids in project
      // Second query: bid_line_items (none)
      let callCount = 0
      Object.defineProperty(chain, 'then', {
        get() {
          return (resolve: (v: unknown) => void) => {
            callCount++
            if (callCount === 1) {
              // 5 bids total
              resolve({
                data: [
                  { id: 'bid-001' }, { id: 'bid-002' }, { id: 'bid-003' },
                  { id: 'bid-004' }, { id: 'bid-005' },
                ],
                error: null,
              })
            } else if (callCount === 2) {
              // 2 already have line items
              resolve({
                data: [{ bid_id: 'bid-001' }, { bid_id: 'bid-003' }],
                error: null,
              })
            } else {
              // Subsequent queries from reextractBid: bid_documents/file_inventory lookups
              resolve({ data: [], error: null })
            }
          }
        },
        configurable: true,
      })

      // Bid lookups for the 3 bids that need processing
      chain.single
        .mockResolvedValueOnce({
          data: { id: 'bid-002', category: 'Framing', vendor_name: 'FrameCo', project_id: 'proj-001' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'bid-004', category: 'Roofing', vendor_name: 'RoofCo', project_id: 'proj-001' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'bid-005', category: 'HVAC', vendor_name: 'HVACCo', project_id: 'proj-001' },
          error: null,
        })

      const result = await reextractAllBids('proj-001', { concurrency: 2 })

      expect(result.total).toBe(3) // 5 total - 2 with existing items = 3
      // All return "No document found" since our mock returns empty data for file lookups
      expect(result.failed).toBe(3)
      expect(result.succeeded).toBe(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
