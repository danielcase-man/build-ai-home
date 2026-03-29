import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'

// Create mock inline — vi.mock is hoisted, so we can't reference outer variables
const mockSetup = createMockSupabase()
const mockChain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

import { getWatermark, getAllWatermarks, updateWatermark, shouldProcess, resetWatermark } from './source-watermarks'

describe('source-watermarks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-setup the chain defaults
    for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'gte', 'lte', 'order', 'limit'] as const) {
      mockChain[method].mockReturnValue(mockChain)
    }
    mockChain.from.mockReturnValue(mockChain)
  })

  describe('getWatermark', () => {
    it('returns watermark data for a known source', async () => {
      const watermark = {
        source: 'dropbox',
        last_processed_at: '2026-03-29T10:00:00Z',
        items_processed: 413,
        errors: 0,
      }
      mockChain.single.mockResolvedValueOnce({ data: watermark, error: null })

      const result = await getWatermark('dropbox')
      expect(result).toEqual(watermark)
      expect(mockChain.eq).toHaveBeenCalledWith('source', 'dropbox')
    })

    it('returns null for unknown source', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

      const result = await getWatermark('gmail')
      expect(result).toBeNull()
    })
  })

  describe('getAllWatermarks', () => {
    it('returns array of all watermarks', async () => {
      const watermarks = [
        { source: 'dropbox', items_processed: 413 },
        { source: 'gmail', items_processed: 50 },
      ]
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: watermarks, error: null }),
        writable: true,
        configurable: true,
      })

      const result = await getAllWatermarks()
      expect(result).toEqual(watermarks)
    })

    it('returns empty array on error', async () => {
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'fail' } }),
        writable: true,
        configurable: true,
      })

      const result = await getAllWatermarks()
      expect(result).toEqual([])
    })
  })

  describe('shouldProcess', () => {
    it('returns true when watermark is null (first run)', () => {
      expect(shouldProcess(null, 15)).toBe(true)
    })

    it('returns true when enough time has passed', () => {
      const watermark = {
        source: 'dropbox' as const,
        last_processed_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        items_processed: 0,
        errors: 0,
      }
      expect(shouldProcess(watermark, 15)).toBe(true)
    })

    it('returns false when not enough time has passed', () => {
      const watermark = {
        source: 'dropbox' as const,
        last_processed_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        items_processed: 0,
        errors: 0,
      }
      expect(shouldProcess(watermark, 15)).toBe(false)
    })
  })

  describe('updateWatermark', () => {
    it('upserts watermark with accumulated totals', async () => {
      // First call: getWatermark → single
      mockChain.single.mockResolvedValueOnce({
        data: { source: 'dropbox', items_processed: 100, errors: 2, metadata: null, last_processed_id: null },
        error: null,
      })
      // Second: upsert chain resolves
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      await updateWatermark('dropbox', { items_processed: 50, errors: 1 })

      expect(mockChain.upsert).toHaveBeenCalled()
      const upsertCall = mockChain.upsert.mock.calls[0]
      expect(upsertCall[0].source).toBe('dropbox')
      expect(upsertCall[0].items_processed).toBe(150) // 100 + 50
      expect(upsertCall[0].errors).toBe(3) // 2 + 1
    })
  })

  describe('resetWatermark', () => {
    it('deletes the watermark for a source', async () => {
      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      await resetWatermark('dropbox')
      expect(mockChain.delete).toHaveBeenCalled()
      expect(mockChain.eq).toHaveBeenCalledWith('source', 'dropbox')
    })
  })
})
