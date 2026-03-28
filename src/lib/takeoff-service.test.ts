import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'
import type { TakeoffRun, TakeoffItem } from '@/types'

// ─── Mock Setup ────────────────────────────────────────────────────────────

let mockSb: ReturnType<typeof createMockSupabase>

vi.mock('./supabase', () => ({
  get supabase() {
    return mockSb.supabase
  },
}))

import {
  createTakeoffRun,
  getTakeoffRuns,
  getTakeoffRunWithItems,
  updateTakeoffRunStatus,
  insertTakeoffItems,
  getTakeoffItemsByCategory,
  getTakeoffSummary,
  createBidPackageFromTakeoff,
  getBidPackages,
} from './takeoff-service'

// ─── Test Data ─────────────────────────────────────────────────────────────

const sampleRun: TakeoffRun = {
  id: 'run-1',
  project_id: 'proj-1',
  trade: 'framing',
  name: 'Lumber Takeoff v1',
  confidence_pct: 65,
  gaps: ['Header sizes not verified'],
  status: 'draft',
  plan_sources: [{ name: 'Asiri Details 03/12', type: 'detail', confidence: 'text_extractable' }],
}

const sampleItems: TakeoffItem[] = [
  {
    id: 'item-1',
    takeoff_run_id: 'run-1',
    project_id: 'proj-1',
    category: 'wall_framing',
    subcategory: 'exterior_walls',
    trade: 'framing',
    item_name: '2x8 T-Stud 10ft',
    material_spec: 'Thermal Stud',
    quantity: 450,
    unit: 'EA',
    waste_factor: 0.05,
    quantity_with_waste: 472.5,
    source: 'calculated',
    confidence: 'calculated',
  },
  {
    id: 'item-2',
    takeoff_run_id: 'run-1',
    project_id: 'proj-1',
    category: 'wall_framing',
    subcategory: 'interior_walls',
    trade: 'framing',
    item_name: '2x6 Stud 10ft',
    material_spec: 'SPF #2',
    quantity: 600,
    unit: 'EA',
    waste_factor: 0.05,
    quantity_with_waste: 630,
    source: 'calculated',
    confidence: 'estimated',
  },
  {
    id: 'item-3',
    takeoff_run_id: 'run-1',
    project_id: 'proj-1',
    category: 'sheathing',
    trade: 'framing',
    item_name: 'ZIP System 4x8 Sheet',
    material_spec: 'Huber ZIP 7/16',
    quantity: 280,
    unit: 'sheets',
    waste_factor: 0.10,
    quantity_with_waste: 308,
    source: 'calculated',
    confidence: 'calculated',
  },
  {
    id: 'item-4',
    takeoff_run_id: 'run-1',
    project_id: 'proj-1',
    category: 'roof_framing',
    trade: 'framing',
    item_name: 'Ridge beam - LVL',
    quantity: 1,
    unit: 'EA',
    confidence: 'gap',
    source: 'estimated',
  },
]

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('takeoff-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTakeoffRun', () => {
    it('inserts a takeoff run and returns it', async () => {
      mockSb = createMockSupabase({ data: sampleRun })
      const result = await createTakeoffRun({
        project_id: 'proj-1',
        trade: 'framing',
        name: 'Lumber Takeoff v1',
        confidence_pct: 65,
        gaps: ['Header sizes not verified'],
        status: 'draft',
      })
      expect(result).toEqual(sampleRun)
      expect(mockSb.chain.from).toHaveBeenCalledWith('takeoff_runs')
      expect(mockSb.chain.insert).toHaveBeenCalled()
    })

    it('returns null on error', async () => {
      mockSb = createMockSupabase({ error: { message: 'insert failed' } })
      const result = await createTakeoffRun({
        project_id: 'proj-1',
        trade: 'framing',
        name: 'Test',
        status: 'draft',
      })
      expect(result).toBeNull()
    })
  })

  describe('getTakeoffRuns', () => {
    it('returns runs for a project', async () => {
      mockSb = createMockSupabase({ data: [sampleRun] })
      const result = await getTakeoffRuns('proj-1')
      expect(result).toEqual([sampleRun])
      expect(mockSb.chain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
    })

    it('filters by trade', async () => {
      mockSb = createMockSupabase({ data: [sampleRun] })
      await getTakeoffRuns('proj-1', { trade: 'framing' })
      expect(mockSb.chain.eq).toHaveBeenCalledWith('trade', 'framing')
    })

    it('returns empty array on error', async () => {
      mockSb = createMockSupabase({ error: { message: 'fail' } })
      const result = await getTakeoffRuns('proj-1')
      expect(result).toEqual([])
    })
  })

  describe('getTakeoffRunWithItems', () => {
    it('returns run with items', async () => {
      // First call: get the run (via .single())
      // Second call: get items (via thenable)
      // We need to handle two separate from() calls
      mockSb = createMockSupabase({ data: sampleRun })

      // Override: second from() call returns items
      let callCount = 0
      mockSb.chain.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // Run query — ends with .single()
          mockSb.chain.single.mockResolvedValueOnce({ data: sampleRun, error: null })
        } else {
          // Items query — ends as thenable
          Object.defineProperty(mockSb.chain, 'then', {
            value: (resolve: (v: unknown) => void) => resolve({ data: sampleItems, error: null }),
            writable: true,
            configurable: true,
          })
        }
        return mockSb.chain
      })

      const result = await getTakeoffRunWithItems('run-1')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('run-1')
      expect(result!.items).toEqual(sampleItems)
    })
  })

  describe('updateTakeoffRunStatus', () => {
    it('updates status', async () => {
      mockSb = createMockSupabase({})
      // update needs to resolve without error
      mockSb.chain.update.mockReturnValue(mockSb.chain)
      Object.defineProperty(mockSb.chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      const result = await updateTakeoffRunStatus('run-1', 'final')
      expect(result).toBe(true)
      expect(mockSb.chain.update).toHaveBeenCalledWith({ status: 'final' })
    })
  })

  describe('insertTakeoffItems', () => {
    it('inserts items in bulk', async () => {
      mockSb = createMockSupabase({})
      Object.defineProperty(mockSb.chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ error: null }),
        writable: true,
        configurable: true,
      })

      const items = sampleItems.map(({ id, created_at, updated_at, quantity_with_waste, total_cost, ...rest }) => rest)
      const result = await insertTakeoffItems(items)
      expect(result.inserted).toBe(4)
      expect(result.errors).toHaveLength(0)
    })

    it('reports errors on failed batch', async () => {
      mockSb = createMockSupabase({ error: { message: 'constraint violation' } })
      const items = [{ takeoff_run_id: 'run-1', project_id: 'proj-1', category: 'test', trade: 'framing', item_name: 'test', quantity: 1, unit: 'EA', source: 'calculated' as const, confidence: 'calculated' as const }]
      const result = await insertTakeoffItems(items)
      expect(result.inserted).toBe(0)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('getTakeoffItemsByCategory', () => {
    it('groups items by category/subcategory', async () => {
      mockSb = createMockSupabase({ data: sampleItems })
      const result = await getTakeoffItemsByCategory('run-1')
      expect(result['wall_framing/exterior_walls']).toHaveLength(1)
      expect(result['wall_framing/interior_walls']).toHaveLength(1)
      expect(result['sheathing']).toHaveLength(1)
      expect(result['roof_framing']).toHaveLength(1)
    })
  })

  describe('getTakeoffSummary', () => {
    it('calculates summary stats', async () => {
      mockSb = createMockSupabase({ data: sampleItems })
      const result = await getTakeoffSummary('run-1')
      expect(result.totalItems).toBe(4)
      expect(result.gapCount).toBe(1) // item-4 has confidence: 'gap'
      expect(result.categories.wall_framing).toBe(2)
      expect(result.categories.sheathing).toBe(1)
      expect(result.categories.roof_framing).toBe(1)
    })
  })

  describe('getBidPackages', () => {
    it('returns bid packages for a project', async () => {
      const pkg = { id: 'pkg-1', project_id: 'proj-1', trade: 'framing', title: 'Framing Package', status: 'draft' }
      mockSb = createMockSupabase({ data: [pkg] })
      const result = await getBidPackages('proj-1')
      expect(result).toEqual([pkg])
      expect(mockSb.chain.from).toHaveBeenCalledWith('bid_packages')
    })

    it('filters by status', async () => {
      mockSb = createMockSupabase({ data: [] })
      await getBidPackages('proj-1', { status: 'sent' })
      expect(mockSb.chain.eq).toHaveBeenCalledWith('status', 'sent')
    })
  })
})
