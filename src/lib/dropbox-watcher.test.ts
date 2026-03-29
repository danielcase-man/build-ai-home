import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'

// Mock supabase (create inline to avoid hoisting issues)
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

// Mock source-watermarks
vi.mock('./source-watermarks', () => ({
  getWatermark: vi.fn().mockResolvedValue(null),
  updateWatermark: vi.fn().mockResolvedValue(undefined),
}))

// Mock agent-router
vi.mock('./agent-router', () => ({
  classifyFileByPath: vi.fn().mockReturnValue('general'),
}))

import { extractFolderCategory, getInventoryStats } from './dropbox-watcher'

describe('dropbox-watcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractFolderCategory', () => {
    const BASE = 'C:/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove'

    it('extracts category from Bids subfolder', () => {
      const result = extractFolderCategory(`${BASE}/Development/Bids/Cabinets/quote.pdf`)
      expect(result).toBe('Development/Bids/Cabinets')
    })

    it('extracts category from top-level folder', () => {
      const result = extractFolderCategory(`${BASE}/Development/Plans/floor_plan.pdf`)
      expect(result).toBe('Development/Plans')
    })

    it('handles deep paths by taking first 3 levels', () => {
      const result = extractFolderCategory(`${BASE}/Development/Bids/Appliances/FBS Appliances/file.pdf`)
      expect(result).toBe('Development/Bids/Appliances')
    })

    it('handles root-level files', () => {
      const result = extractFolderCategory(`${BASE}/notes.txt`)
      expect(result).toBe('')
    })
  })

  describe('getInventoryStats', () => {
    it('returns counts by status and domain', async () => {
      const files = [
        { processing_status: 'pending', agent_domain: 'bid_analysis' },
        { processing_status: 'pending', agent_domain: 'bid_analysis' },
        { processing_status: 'completed', agent_domain: 'bid_analysis' },
        { processing_status: 'failed', agent_domain: 'takeoff' },
        { processing_status: 'skipped', agent_domain: null },
      ]

      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: files, error: null }),
        writable: true,
        configurable: true,
      })

      const stats = await getInventoryStats('proj-001')
      expect(stats.total).toBe(5)
      expect(stats.pending).toBe(2)
      expect(stats.completed).toBe(1)
      expect(stats.failed).toBe(1)
      expect(stats.skipped).toBe(1)
      expect(stats.byDomain.bid_analysis).toBe(3)
      expect(stats.byDomain.takeoff).toBe(1)
    })

    it('returns zeros when no files exist', async () => {
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
        writable: true,
        configurable: true,
      })

      const stats = await getInventoryStats('proj-001')
      expect(stats.total).toBe(0)
      expect(stats.pending).toBe(0)
    })
  })
})
