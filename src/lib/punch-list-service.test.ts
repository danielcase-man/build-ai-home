import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'insert', 'update', 'eq', 'order', 'limit', 'single', 'from'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

import {
  getPunchList,
  getPunchListStats,
  createPunchItem,
  updatePunchItem,
  markPunchResolved,
  getInspections,
  scheduleInspection,
  recordInspectionResult,
  createFromInspection,
} from './punch-list-service'

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

describe('Punch List Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  describe('getPunchList', () => {
    it('returns items filtered by room', async () => {
      const items = [
        { id: 'p1', room: 'Kitchen', description: 'Paint touch-up', severity: 'cosmetic', status: 'identified' },
      ]
      mockSequentialResponses([{ data: items }])

      const result = await getPunchList('proj-001', { room: 'Kitchen' })
      expect(result).toHaveLength(1)
      expect(mockChain.eq).toHaveBeenCalledWith('room', 'Kitchen')
    })
  })

  describe('getPunchListStats', () => {
    it('calculates completion rate', async () => {
      const items = [
        { severity: 'cosmetic', status: 'completed', room: 'Kitchen' },
        { severity: 'functional', status: 'identified', room: 'Kitchen' },
        { severity: 'safety', status: 'verified', room: 'Bath' },
        { severity: 'cosmetic', status: 'in_progress', room: 'Living' },
      ]
      mockSequentialResponses([{ data: items }])

      const stats = await getPunchListStats('proj-001')
      expect(stats.total).toBe(4)
      expect(stats.completionRate).toBe(50) // 2 of 4 completed/verified
      expect(stats.bySeverity.cosmetic).toBe(2)
      expect(stats.byRoom.Kitchen).toBe(2)
    })
  })

  describe('createPunchItem', () => {
    it('creates a punch item', async () => {
      mockChain.single.mockResolvedValueOnce({ data: { id: 'p-new', description: 'Cracked tile' }, error: null })

      const result = await createPunchItem({
        project_id: 'proj-001',
        room: 'Primary Bath',
        location_detail: null,
        category: 'Tile',
        description: 'Cracked tile near shower',
        severity: 'functional',
        status: 'identified',
        assigned_vendor_id: null,
        assigned_vendor_name: null,
        before_photo_id: null,
        after_photo_id: null,
        source: 'owner',
        due_date: null,
        completed_date: null,
        notes: null,
      })

      expect(result?.description).toBe('Cracked tile')
    })
  })

  describe('markPunchResolved', () => {
    it('sets completed status with after photo', async () => {
      mockSequentialResponses([{ data: null }])

      const success = await markPunchResolved('p-1', 'photo-after-1')
      expect(success).toBe(true)
      expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed',
        after_photo_id: 'photo-after-1',
      }))
    })
  })

  describe('createFromInspection', () => {
    it('creates punch items from inspection deficiencies', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'p-from-insp' }, error: null })

      const result = await createFromInspection('proj-001', 'insp-1', [
        { description: 'Missing GFCI outlet', severity: 'safety' },
        { description: 'Loose outlet cover', severity: 'cosmetic' },
      ])

      expect(result.created).toBe(2)
    })
  })

  describe('getInspections', () => {
    it('fetches inspections filtered by status', async () => {
      mockSequentialResponses([{ data: [{ id: 'i1', inspection_type: 'Framing', status: 'scheduled' }] }])

      const result = await getInspections('proj-001', { status: 'scheduled' })
      expect(result).toHaveLength(1)
    })
  })

  describe('scheduleInspection', () => {
    it('creates inspection with scheduled status', async () => {
      mockChain.single.mockResolvedValueOnce({ data: { id: 'i-new', status: 'scheduled' }, error: null })

      const result = await scheduleInspection({
        project_id: 'proj-001',
        inspection_type: 'Foundation pre-pour',
        knowledge_id: null,
        permit_id: null,
        status: 'not_scheduled',
        scheduled_date: '2026-04-01',
        completed_date: null,
        inspector_name: null,
        deficiencies: [],
        photos: [],
        notes: null,
      })

      expect(result?.status).toBe('scheduled')
    })
  })

  describe('recordInspectionResult', () => {
    it('updates inspection with result and deficiencies', async () => {
      mockSequentialResponses([{ data: null }])

      const success = await recordInspectionResult('i-1', {
        status: 'failed',
        inspector_name: 'Bob Inspector',
        deficiencies: [{ description: 'Missing fire stop', severity: 'safety', corrected: false }],
        notes: 'Needs correction before re-inspection',
      })

      expect(success).toBe(true)
    })
  })
})
