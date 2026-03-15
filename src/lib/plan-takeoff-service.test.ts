import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'gte', 'order', 'limit', 'single', 'from'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

const mockCreate = vi.fn()

vi.mock('./ai-clients', () => ({
  getAnthropicClient: () => ({
    messages: { create: mockCreate },
  }),
  parseAIJsonResponse: (text: string) => {
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '')
    }
    return JSON.parse(jsonText)
  },
}))

vi.mock('pdf-parse-fork', () => ({
  default: vi.fn().mockResolvedValue({
    text: 'ROOM SCHEDULE\nKitchen 300sf 10ft ceiling\nPrimary Bedroom 400sf 9ft ceiling\nPrimary Bath 200sf 9ft ceiling\nLiving Room 500sf 12ft ceiling\nDining Room 250sf 10ft ceiling\nFIXTURE SCHEDULE\nRecessed lights 48 total\nSinks 5 total\nToilets 4 total\nWINDOW SCHEDULE\nW1 36x48 DH qty 10\nDOOR SCHEDULE\nD1 36x80 Entry qty 5',
    numpages: 3,
    numrender: 3,
    info: {},
    metadata: null,
    version: '',
  }),
}))

import {
  processUploadedPlan,
  getExtractions,
  getRoomSchedule,
  getFixtureSummary,
  markExtractionReviewed,
  createSelectionsFromTakeoff,
  createBudgetItemsFromTakeoff,
} from './plan-takeoff-service'

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

function mockAIResponse(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  }
}

describe('Plan Takeoff Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  // ── processUploadedPlan ──────────────────────────────────────────────

  describe('processUploadedPlan', () => {
    it('extracts text and runs all extractors', async () => {
      // Each extractor calls AI then stores result
      const roomData = {
        rooms: [{ name: 'Kitchen', floor: '1st', square_footage: 300, ceiling_height: 10, fixtures: [], finishes: [] }],
        total_rooms: 1,
        notes: '',
      }
      const fixtureData = { fixtures: [{ category: 'plumbing', type: 'sink', count: 3 }], totals: { plumbing: 3 }, notes: '' }
      const windowData = { windows: [{ mark: 'W1', size: '36x48', count: 10 }], total_count: 10, notes: '' }
      const doorData = { doors: [{ mark: 'D1', size: '36x80', count: 5 }], total_count: 5, notes: '' }
      const materialData = { materials: [{ category: 'concrete', item: 'foundation', quantity: 85, unit: 'cy' }], notes: '' }

      // Mock AI responses for each extractor
      mockCreate
        .mockResolvedValueOnce(mockAIResponse(roomData))
        .mockResolvedValueOnce(mockAIResponse(fixtureData))
        .mockResolvedValueOnce(mockAIResponse(windowData))
        .mockResolvedValueOnce(mockAIResponse(doorData))
        .mockResolvedValueOnce(mockAIResponse(materialData))

      // Mock DB inserts for extractions and rooms
      mockChain.single.mockResolvedValue({ data: { id: 'ext-001' }, error: null })

      const result = await processUploadedPlan('doc-001', 'proj-001', Buffer.from('fake pdf'), 'plans.pdf')

      expect(mockCreate).toHaveBeenCalledTimes(5) // 5 extractors
      expect(result.totalFixtures).toBe(3)
      expect(result.totalWindows).toBe(10)
      expect(result.totalDoors).toBe(5)
    })

    it('handles PDF with minimal text content', async () => {
      // Override pdf-parse to return minimal text
      const pdfParse = await import('pdf-parse-fork')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({ text: 'hi', numpages: 1, numrender: 1, info: {}, metadata: null, version: '' })

      mockCreate.mockResolvedValueOnce(mockAIResponse({ type: 'minimal document', data: [], notes: 'Very little text' }))
      mockChain.single.mockResolvedValue({ data: { id: 'ext-002' }, error: null })

      const result = await processUploadedPlan('doc-002', 'proj-001', Buffer.from('x'), 'scan.pdf')

      // Should only run general extractor (not all 5)
      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(result.rooms).toEqual([])
    })
  })

  // ── getExtractions ───────────────────────────────────────────────────

  describe('getExtractions', () => {
    it('fetches extractions filtered by type', async () => {
      const extractions = [
        { id: 'e1', extraction_type: 'room_schedule', extracted_data: {}, confidence: 0.85 },
      ]
      mockSequentialResponses([{ data: extractions }])

      const result = await getExtractions('proj-001', { type: 'room_schedule' })
      expect(result).toHaveLength(1)
      expect(mockChain.eq).toHaveBeenCalledWith('extraction_type', 'room_schedule')
    })

    it('returns empty on error', async () => {
      mockSequentialResponses([{ data: null, error: { message: 'DB error' } }])

      const result = await getExtractions('proj-001')
      expect(result).toEqual([])
    })
  })

  // ── getRoomSchedule ──────────────────────────────────────────────────

  describe('getRoomSchedule', () => {
    it('fetches rooms ordered by floor and name', async () => {
      const rooms = [
        { id: 'r1', name: 'Kitchen', floor: '1st', square_footage: 300 },
        { id: 'r2', name: 'Primary Bedroom', floor: '2nd', square_footage: 400 },
      ]
      mockSequentialResponses([{ data: rooms }])

      const result = await getRoomSchedule('proj-001')
      expect(result).toHaveLength(2)
      expect(mockChain.order).toHaveBeenCalledWith('floor', { ascending: true })
    })
  })

  // ── getFixtureSummary ────────────────────────────────────────────────

  describe('getFixtureSummary', () => {
    it('aggregates fixture counts across extractions', async () => {
      const extractions = [{
        id: 'e1',
        extraction_type: 'fixture_count',
        extracted_data: {
          fixtures: [
            { category: 'plumbing', type: 'sink', count: 5 },
            { category: 'plumbing', type: 'toilet', count: 4 },
            { category: 'lighting', type: 'recessed', count: 48 },
          ],
        },
        confidence: 0.9,
      }]
      mockSequentialResponses([{ data: extractions }])

      const result = await getFixtureSummary('proj-001')
      expect(result.categories.plumbing).toBe(9)
      expect(result.categories.lighting).toBe(48)
      expect(result.items).toHaveLength(3)
    })
  })

  // ── markExtractionReviewed ───────────────────────────────────────────

  describe('markExtractionReviewed', () => {
    it('updates reviewed flag', async () => {
      mockSequentialResponses([{ data: null }])

      const result = await markExtractionReviewed('ext-001')
      expect(result).toBe(true)
      expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ reviewed: true }))
    })
  })

  // ── createSelectionsFromTakeoff ──────────────────────────────────────

  describe('createSelectionsFromTakeoff', () => {
    it('creates selection records from fixture data', async () => {
      const extraction = {
        id: 'ext-001',
        extracted_data: {
          fixtures: [
            { category: 'plumbing', type: 'sink', count: 2, rooms: ['Kitchen', 'Primary Bath'] },
            { category: 'lighting', type: 'recessed', count: 12, rooms: ['Living Room'] },
          ],
        },
      }

      mockChain.single.mockResolvedValueOnce({ data: extraction, error: null })
      // 3 insert calls (2 rooms for sink + 1 for recessed)
      mockSequentialResponses([{ data: null }, { data: null }, { data: null }])

      const result = await createSelectionsFromTakeoff('proj-001', 'ext-001')
      expect(result.created).toBe(3)
      expect(result.errors).toHaveLength(0)
    })

    it('returns error for missing extraction', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      const result = await createSelectionsFromTakeoff('proj-001', 'nonexistent')
      expect(result.created).toBe(0)
      expect(result.errors).toContain('Extraction not found')
    })
  })

  // ── createBudgetItemsFromTakeoff ─────────────────────────────────────

  describe('createBudgetItemsFromTakeoff', () => {
    it('creates budget items from material data', async () => {
      const extraction = {
        id: 'ext-002',
        extracted_data: {
          materials: [
            { category: 'concrete', item: 'foundation concrete', quantity: 85, unit: 'cubic yards', specs: '3500 PSI' },
            { category: 'framing', item: '2x6 studs', quantity: 1200, unit: 'each' },
          ],
        },
      }

      mockChain.single.mockResolvedValueOnce({ data: extraction, error: null })
      mockSequentialResponses([{ data: null }, { data: null }])

      const result = await createBudgetItemsFromTakeoff('proj-001', 'ext-002')
      expect(result.created).toBe(2)
      expect(result.errors).toHaveLength(0)
    })
  })
})
