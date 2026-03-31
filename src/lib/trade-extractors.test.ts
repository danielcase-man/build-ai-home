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

import {
  extractFoundationTakeoff,
  extractFramingTakeoff,
  extractRoofingTakeoff,
  extractInsulationTakeoff,
  extractSiteWorkTakeoff,
  extractWindowDoorSchedule,
  runTradeExtractors,
} from './plan-takeoff-service'

function mockAIResponse(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  }
}

describe('Trade-Specific Extractors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  // ── Individual extractor types ──────────────────────────────────────

  describe('extractFoundationTakeoff', () => {
    it('calls runExtractor with foundation_takeoff type', async () => {
      const foundationData = {
        slab: { area_sqft: 7526, perimeter_lf: 400, concrete_cy: 85, concrete_psi: 3500 },
        rebar: { spec: '#4', quantity_lf: 2000 },
        post_tension: { cable_count: 120, spec: '1/2" 270ksi' },
        piers: [],
        grade_beams: [],
        vapor_barrier_sqft: 7526,
        notes: 'PT slab on grade',
      }
      mockCreate.mockResolvedValueOnce(mockAIResponse(foundationData))

      const result = await extractFoundationTakeoff('foundation plan text', 'foundation.pdf', 'doc-001', 'proj-001')

      expect(result.extraction_type).toBe('foundation_takeoff')
      expect(result.confidence).toBe(0.85)
      expect(result.extracted_data.slab).toBeDefined()
      expect(mockCreate).toHaveBeenCalledTimes(1)
      // Verify the prompt mentions foundation-specific terms
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.messages[0].content).toContain('foundation')
    })
  })

  describe('extractFramingTakeoff', () => {
    it('calls runExtractor with framing_takeoff type', async () => {
      const framingData = {
        walls: { exterior_lf: 500, interior_lf: 800, height: 10, stud_spacing: '16" OC' },
        headers: [{ size: '4x12', span: '8ft', quantity: 4 }],
        beams: [{ size: 'LVL 3.5x14', span: '20ft', quantity: 2 }],
        rafters: { spec: 'Trusses', count: 45 },
        sheathing: { roof_sqft: 8000, wall_sqft: 5000 },
        plates: { material: '2x6', total_lf: 2600 },
        notes: '',
      }
      mockCreate.mockResolvedValueOnce(mockAIResponse(framingData))

      const result = await extractFramingTakeoff('structural plan text', 'struct.pdf', 'doc-002', 'proj-001')

      expect(result.extraction_type).toBe('framing_takeoff')
      expect(result.confidence).toBe(0.85)
      expect(result.extracted_data.walls).toBeDefined()
    })
  })

  describe('extractRoofingTakeoff', () => {
    it('calls runExtractor with roofing_takeoff type', async () => {
      const roofData = {
        roof_sqft: 8500,
        pitch: '8:12',
        ridge_lf: 120,
        valley_lf: 60,
        hip_lf: 80,
        eave_lf: 400,
        material: 'standing seam metal',
        flashing_lf: 200,
        drip_edge_lf: 400,
        vents: [{ type: 'ridge', count: 4 }],
        gutter_lf: 300,
        downspout_count: 8,
        notes: '',
      }
      mockCreate.mockResolvedValueOnce(mockAIResponse(roofData))

      const result = await extractRoofingTakeoff('elevation text', 'elevations.pdf', 'doc-003', 'proj-001')

      expect(result.extraction_type).toBe('roofing_takeoff')
      expect(result.confidence).toBe(0.85)
      expect(result.extracted_data.roof_sqft).toBe(8500)
    })
  })

  describe('extractInsulationTakeoff', () => {
    it('calls runExtractor with insulation_takeoff type', async () => {
      const insulationData = {
        exterior_walls: { r_value: 'R-23', material: 'open-cell spray foam', area_sqft: 5000 },
        ceiling: { r_value: 'R-38', material: 'blown fiberglass', area_sqft: 7526 },
        rigid: { spec: '2" XPS', area_sqft: 500 },
        spray_foam: { area_sqft: 5000 },
        air_barrier: { spec: 'continuous', area_sqft: 12000 },
        notes: 'IRC 2021 climate zone 2',
      }
      mockCreate.mockResolvedValueOnce(mockAIResponse(insulationData))

      const result = await extractInsulationTakeoff('detail text', 'details.pdf', 'doc-004', 'proj-001')

      expect(result.extraction_type).toBe('insulation_takeoff')
      expect(result.confidence).toBe(0.85)
      expect(result.extracted_data.exterior_walls).toBeDefined()
    })
  })

  describe('extractSiteWorkTakeoff', () => {
    it('calls runExtractor with site_work_takeoff type', async () => {
      const siteData = {
        earthwork: { cut_cy: 500, fill_cy: 200 },
        driveway: { area_sqft: 2500, material: 'concrete' },
        utilities: [{ type: 'water', trench_lf: 300 }, { type: 'electric', trench_lf: 250 }],
        drainage: [{ type: 'swale', length_lf: 150 }],
        retaining_walls: [],
        erosion_control: [{ measure: 'silt fence', quantity: '400 LF' }],
        notes: '',
      }
      mockCreate.mockResolvedValueOnce(mockAIResponse(siteData))

      const result = await extractSiteWorkTakeoff('civil plan text', 'grading.pdf', 'doc-005', 'proj-001')

      expect(result.extraction_type).toBe('site_work_takeoff')
      expect(result.confidence).toBe(0.85)
      expect(result.extracted_data.earthwork).toBeDefined()
    })
  })

  describe('extractWindowDoorSchedule', () => {
    it('calls runExtractor with window_door_schedule type', async () => {
      const scheduleData = {
        windows: [{ mark: 'W1', width: 36, height: 48, type: 'double-hung', quantity: 10, room: 'Living Room' }],
        doors: [{ mark: 'D1', width: 36, height: 80, type: 'exterior', material: 'fiberglass', hardware: 'lever', quantity: 1, location: 'Front Entry' }],
        total_windows: 10,
        total_doors: 1,
        notes: '',
      }
      mockCreate.mockResolvedValueOnce(mockAIResponse(scheduleData))

      const result = await extractWindowDoorSchedule('architectural text', 'arch.pdf', 'doc-006', 'proj-001')

      expect(result.extraction_type).toBe('window_door_schedule')
      expect(result.confidence).toBe(0.85)
      expect(result.extracted_data.total_windows).toBe(10)
    })
  })

  // ── Empty / low-confidence ──────────────────────────────────────────

  describe('empty text handling', () => {
    it('returns low confidence when AI finds no data', async () => {
      mockCreate.mockResolvedValueOnce(mockAIResponse({ notes: 'No foundation data found in this document' }))

      const result = await extractFoundationTakeoff('', 'empty.pdf', 'doc-007', 'proj-001')

      expect(result.confidence).toBe(0.1)
      expect(Object.keys(result.extracted_data)).toEqual(['notes'])
    })
  })

  // ── Orchestrator ────────────────────────────────────────────────────

  describe('runTradeExtractors', () => {
    it('routes foundation plan type to extractFoundationTakeoff', async () => {
      const foundationData = {
        slab: { area_sqft: 7526 },
        notes: '',
      }
      mockCreate.mockResolvedValueOnce(mockAIResponse(foundationData))

      const results = await runTradeExtractors('foundation', 'text', 'file.pdf', 'doc-001', 'proj-001')

      expect(results).toHaveLength(1)
      expect(results[0].extraction_type).toBe('foundation_takeoff')
    })

    it('routes structural plan type to framing + roofing (parallel)', async () => {
      const framingData = { walls: { exterior_lf: 500 }, notes: '' }
      const roofData = { roof_sqft: 8500, notes: '' }
      mockCreate
        .mockResolvedValueOnce(mockAIResponse(framingData))
        .mockResolvedValueOnce(mockAIResponse(roofData))

      const results = await runTradeExtractors('structural', 'text', 'file.pdf', 'doc-001', 'proj-001')

      expect(results).toHaveLength(2)
      const types = results.map(r => r.extraction_type).sort()
      expect(types).toEqual(['framing_takeoff', 'roofing_takeoff'])
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('routes architectural plan type to window_door_schedule + room_schedule', async () => {
      const windowDoorData = { windows: [], doors: [], total_windows: 0, total_doors: 0, notes: '' }
      const roomData = { rooms: [], total_rooms: 0, notes: '' }
      mockCreate
        .mockResolvedValueOnce(mockAIResponse(windowDoorData))
        .mockResolvedValueOnce(mockAIResponse(roomData))

      const results = await runTradeExtractors('architectural', 'text', 'file.pdf', 'doc-001', 'proj-001')

      expect(results).toHaveLength(2)
      const types = results.map(r => r.extraction_type).sort()
      expect(types).toEqual(['room_schedule', 'window_door_schedule'])
    })

    it('routes site plan type to extractSiteWorkTakeoff', async () => {
      const siteData = { earthwork: { cut_cy: 500, fill_cy: 200 }, notes: '' }
      mockCreate.mockResolvedValueOnce(mockAIResponse(siteData))

      const results = await runTradeExtractors('site', 'text', 'file.pdf', 'doc-001', 'proj-001')

      expect(results).toHaveLength(1)
      expect(results[0].extraction_type).toBe('site_work_takeoff')
    })

    it('routes detail plan type to extractInsulationTakeoff', async () => {
      const insulationData = { exterior_walls: { r_value: 'R-23' }, notes: '' }
      mockCreate.mockResolvedValueOnce(mockAIResponse(insulationData))

      const results = await runTradeExtractors('detail', 'text', 'file.pdf', 'doc-001', 'proj-001')

      expect(results).toHaveLength(1)
      expect(results[0].extraction_type).toBe('insulation_takeoff')
    })

    it('routes unknown plan type to extractGeneral', async () => {
      const generalData = { type: 'unknown document', data: [], notes: 'Could not classify' }
      mockCreate.mockResolvedValueOnce(mockAIResponse(generalData))

      const results = await runTradeExtractors('plumbing', 'text', 'file.pdf', 'doc-001', 'proj-001')

      expect(results).toHaveLength(1)
      expect(results[0].extraction_type).toBe('general')
    })
  })
})
