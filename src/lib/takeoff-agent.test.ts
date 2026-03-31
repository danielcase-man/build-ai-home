import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'
import type { ChangeEvent } from '@/types'
import type { DocumentExtraction } from './plan-takeoff-service'

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Supabase mock (inline to avoid hoisting issues)
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

// Mock fs
const mockReadFileSync = vi.fn().mockReturnValue(Buffer.from('fake pdf content'))
const mockStatSync = vi.fn().mockReturnValue({ size: 1024 })
vi.mock('fs', () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
}))

// Mock dropbox-watcher
const mockUpdateFileStatus = vi.fn().mockResolvedValue(undefined)
vi.mock('./dropbox-watcher', () => ({
  updateFileStatus: (...args: unknown[]) => mockUpdateFileStatus(...args),
}))

// Mock agent-router
vi.mock('./agent-router', () => ({
  registerAgent: vi.fn(),
}))

// Mock plan-discovery-service
const mockDiscoverLatestPlans = vi.fn().mockResolvedValue({
  plans: {},
  allVersions: [],
  missingTypes: ['architectural', 'structural', 'foundation'],
})
vi.mock('./plan-discovery-service', () => ({
  discoverLatestPlans: (...args: unknown[]) => mockDiscoverLatestPlans(...args),
}))

// Mock plan-takeoff-service
const mockRunTradeExtractors = vi.fn().mockResolvedValue([])
const mockStoreExtraction = vi.fn().mockResolvedValue(null)
vi.mock('./plan-takeoff-service', () => ({
  runTradeExtractors: (...args: unknown[]) => mockRunTradeExtractors(...args),
  storeExtraction: (...args: unknown[]) => mockStoreExtraction(...args),
}))

// Mock document-analyzer
const mockExtractTextFromPDF = vi.fn().mockResolvedValue('Substantial extracted text content for testing purposes that exceeds the minimum threshold requirement of fifty characters.')
vi.mock('./document-analyzer', () => ({
  extractTextFromPDF: (...args: unknown[]) => mockExtractTextFromPDF(...args),
}))

// Mock takeoff-service
const mockCreateTakeoffRun = vi.fn().mockResolvedValue({ id: 'run-001', project_id: 'proj-1', trade: 'Foundation', status: 'draft' })
const mockInsertTakeoffItems = vi.fn().mockResolvedValue({ inserted: 0, errors: [] })
const mockGetTakeoffRuns = vi.fn().mockResolvedValue([])
const mockUpdateTakeoffRunStatus = vi.fn().mockResolvedValue(true)
vi.mock('./takeoff-service', () => ({
  createTakeoffRun: (...args: unknown[]) => mockCreateTakeoffRun(...args),
  insertTakeoffItems: (...args: unknown[]) => mockInsertTakeoffItems(...args),
  getTakeoffRuns: (...args: unknown[]) => mockGetTakeoffRuns(...args),
  updateTakeoffRunStatus: (...args: unknown[]) => mockUpdateTakeoffRunStatus(...args),
}))

// ─── Import after mocks ────────────────────────────────────────────────────

import { handleTakeoff, mapExtractionToItems, EXTRACTION_TO_TRADE } from './takeoff-agent'

// ─── Helpers ────────────────────────────────────────────────────────────────

const PROJECT_ID = 'test-project-id'

function makeFileEvent(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    source: 'dropbox',
    domain: 'takeoff',
    file_path: '/Dropbox/Development/Plans/Structural/foundation-plan.pdf',
    file_name: 'foundation-plan.pdf',
    file_type: 'pdf',
    detected_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeFoundationExtraction(documentId = 'file-001'): DocumentExtraction {
  return {
    id: 'ext-f-001',
    document_id: documentId,
    project_id: PROJECT_ID,
    extraction_type: 'foundation_takeoff',
    extracted_data: {
      slab: { area_sqft: 7500, perimeter_lf: 350, concrete_cy: 85, concrete_psi: 3500 },
      rebar: { spec: '#4 @ 18" OC', quantity_lf: 4200 },
      post_tension: { cable_count: 42, spec: '1/2" 270K' },
      piers: [{ location: 'perimeter', count: 24, dimensions: '12" dia x 24" deep' }],
      vapor_barrier_sqft: 7500,
      notes: 'PT slab on grade',
    },
    confidence: 0.85,
    ai_notes: 'PT slab on grade',
    reviewed: false,
  }
}

function makeFramingExtraction(documentId = 'file-002'): DocumentExtraction {
  return {
    id: 'ext-fr-001',
    document_id: documentId,
    project_id: PROJECT_ID,
    extraction_type: 'framing_takeoff',
    extracted_data: {
      walls: { exterior_lf: 520, interior_lf: 1200, height: 9, stud_spacing: '16" OC' },
      headers: [
        { size: '4x12', span: '8ft', quantity: 6 },
        { size: '6x12', span: '12ft', quantity: 3 },
      ],
      beams: [{ size: 'LVL 3.5x14', span: '20ft', quantity: 2 }],
      sheathing: { roof_sqft: 8200, wall_sqft: 4800 },
      plates: { material: '2x6', total_lf: 3440 },
      notes: 'Standard framing',
    },
    confidence: 0.82,
    ai_notes: 'Standard framing',
    reviewed: false,
  }
}

function makeRoofingExtraction(documentId = 'file-002'): DocumentExtraction {
  return {
    id: 'ext-r-001',
    document_id: documentId,
    project_id: PROJECT_ID,
    extraction_type: 'roofing_takeoff',
    extracted_data: {
      roof_sqft: 9200,
      pitch: '8:12',
      ridge_lf: 120,
      material: 'standing seam metal',
      flashing_lf: 200,
      drip_edge_lf: 350,
      gutter_lf: 280,
      vents: [{ type: 'ridge', count: 3 }, { type: 'turbine', count: 2 }],
      notes: 'Metal roof',
    },
    confidence: 0.88,
    ai_notes: 'Metal roof',
    reviewed: false,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('takeoff-agent', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default supabase responses:
    // - No existing documents (dedup check for Phase A)
    // - No existing extractions (dedup check for Phase C)
    chain.limit.mockResolvedValue({ data: [], error: null })
    chain.single.mockResolvedValue({ data: null, error: null })
    chain.insert.mockResolvedValue({ data: { id: 'doc-1' }, error: null })

    // Make chain thenable for queries without .single()
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      writable: true,
      configurable: true,
    })

    // Reset mock defaults
    mockDiscoverLatestPlans.mockResolvedValue({
      plans: {},
      allVersions: [],
      missingTypes: ['architectural', 'structural', 'foundation'],
    })
    mockRunTradeExtractors.mockResolvedValue([])
    mockStoreExtraction.mockResolvedValue(null)
    mockCreateTakeoffRun.mockResolvedValue({ id: 'run-001', project_id: PROJECT_ID, trade: 'Test', status: 'draft' })
    mockInsertTakeoffItems.mockResolvedValue({ inserted: 0, errors: [] })
    mockGetTakeoffRuns.mockResolvedValue([])
    mockExtractTextFromPDF.mockResolvedValue('Substantial extracted text content for testing purposes that exceeds the minimum threshold requirement of fifty characters.')
    mockReadFileSync.mockReturnValue(Buffer.from('fake pdf content'))
  })

  // ── Phase A Tests ───────────────────────────────────────────────────────

  describe('Phase A: Catalog files', () => {
    it('catalogs new files into documents table', async () => {
      const events = [
        makeFileEvent({
          file_path: '/Dropbox/Plans/Structural/floor-plan.pdf',
          file_name: 'floor-plan.pdf',
          file_type: 'pdf',
        }),
      ]

      const result = await handleTakeoff(events, PROJECT_ID)

      expect(result.domain).toBe('takeoff')
      expect(result.action).toBe('structural_takeoff')
      expect(chain.from).toHaveBeenCalledWith('documents')
      expect(result.records_created).toBeGreaterThanOrEqual(1)
      expect(result.details).toContain('Cataloged 1 file(s)')
    })

    it('skips files already cataloged in documents table', async () => {
      // Mock: document already exists
      chain.limit.mockResolvedValue({ data: [{ id: 'existing-doc' }], error: null })

      const events = [makeFileEvent()]
      const result = await handleTakeoff(events, PROJECT_ID)

      // Phase A should not create new document records
      // (records_created may include Phase D items, but we check the details string)
      expect(result.details).toContain('Cataloged 0 file(s)')
      expect(mockUpdateFileStatus).toHaveBeenCalledWith(
        expect.any(String),
        'skipped',
        expect.objectContaining({ error_message: 'Already cataloged' })
      )
    })

    it('returns zero records for empty events', async () => {
      const result = await handleTakeoff([], PROJECT_ID)
      expect(result.details).toBe('No plan files to catalog')
      expect(result.records_created).toBe(0)
    })
  })

  // ── Phase B Tests ───────────────────────────────────────────────────────

  describe('Phase B: Discover latest plans', () => {
    it('calls discoverLatestPlans when there are new file events', async () => {
      const events = [makeFileEvent()]

      await handleTakeoff(events, PROJECT_ID)

      expect(mockDiscoverLatestPlans).toHaveBeenCalledWith(PROJECT_ID)
    })

    it('does not call discoverLatestPlans when no file events', async () => {
      // Events without file_path/file_name are filtered out
      const events: ChangeEvent[] = []

      await handleTakeoff(events, PROJECT_ID)

      expect(mockDiscoverLatestPlans).not.toHaveBeenCalled()
    })
  })

  // ── Phase C Tests ───────────────────────────────────────────────────────

  describe('Phase C: Extract structural data', () => {
    it('reads PDF and runs trade extractors for discovered plans', async () => {
      mockDiscoverLatestPlans.mockResolvedValue({
        plans: {
          foundation: {
            fileId: 'file-001',
            filePath: '/Dropbox/Plans/Foundation/foundation-REV2.pdf',
            fileName: 'foundation-REV2.pdf',
            planType: 'foundation',
            version: 2,
            versionLabel: 'REV2',
            modifiedAt: '2026-03-01',
            confidence: 0.95,
          },
        },
        allVersions: [],
        missingTypes: [],
      })

      const extraction = makeFoundationExtraction()
      mockRunTradeExtractors.mockResolvedValue([extraction])
      mockStoreExtraction.mockResolvedValue(extraction)

      const events = [makeFileEvent()]
      await handleTakeoff(events, PROJECT_ID)

      expect(mockReadFileSync).toHaveBeenCalledWith('/Dropbox/Plans/Foundation/foundation-REV2.pdf')
      expect(mockExtractTextFromPDF).toHaveBeenCalled()
      expect(mockRunTradeExtractors).toHaveBeenCalledWith(
        'foundation',
        expect.any(String),
        'foundation-REV2.pdf',
        'file-001',
        PROJECT_ID
      )
    })

    it('skips plans that already have extractions (dedup)', async () => {
      mockDiscoverLatestPlans.mockResolvedValue({
        plans: {
          foundation: {
            fileId: 'file-001',
            filePath: '/Dropbox/Plans/Foundation/foundation.pdf',
            fileName: 'foundation.pdf',
            planType: 'foundation',
            version: 1,
            versionLabel: 'original',
            modifiedAt: '2026-03-01',
            confidence: 0.95,
          },
        },
        allVersions: [],
        missingTypes: [],
      })

      // Mock: extraction already exists for this document
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({
          data: [{ id: 'ext-existing', extraction_type: 'foundation_takeoff' }],
          error: null,
        }),
        writable: true,
        configurable: true,
      })

      const events = [makeFileEvent()]
      await handleTakeoff(events, PROJECT_ID)

      // Should not read the file or run extractors
      expect(mockRunTradeExtractors).not.toHaveBeenCalled()
    })

    it('handles file read errors gracefully without blocking other plans', async () => {
      mockDiscoverLatestPlans.mockResolvedValue({
        plans: {
          foundation: {
            fileId: 'file-001',
            filePath: '/Dropbox/Plans/Foundation/missing.pdf',
            fileName: 'missing.pdf',
            planType: 'foundation',
            version: 1,
            versionLabel: 'original',
            modifiedAt: '2026-03-01',
            confidence: 0.95,
          },
          structural: {
            fileId: 'file-002',
            filePath: '/Dropbox/Plans/Structural/framing.pdf',
            fileName: 'framing.pdf',
            planType: 'structural',
            version: 1,
            versionLabel: 'original',
            modifiedAt: '2026-03-01',
            confidence: 0.90,
          },
        },
        allVersions: [],
        missingTypes: [],
      })

      // First call throws (missing file), second succeeds
      mockReadFileSync
        .mockImplementationOnce(() => { throw new Error('ENOENT: no such file') })
        .mockReturnValueOnce(Buffer.from('valid pdf content'))

      const framingExtraction = makeFramingExtraction('file-002')
      mockRunTradeExtractors.mockResolvedValue([framingExtraction])
      mockStoreExtraction.mockResolvedValue(framingExtraction)

      const events = [makeFileEvent()]
      const result = await handleTakeoff(events, PROJECT_ID)

      // Extractors should still be called for the second plan
      expect(mockRunTradeExtractors).toHaveBeenCalledTimes(1)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.includes('missing.pdf'))).toBe(true)
    })
  })

  // ── Phase D Tests ───────────────────────────────────────────────────────

  describe('Phase D: Create takeoff runs + items', () => {
    function setupFullPipeline(extractions: DocumentExtraction[]) {
      mockDiscoverLatestPlans.mockResolvedValue({
        plans: {
          foundation: {
            fileId: 'file-001',
            filePath: '/Dropbox/Plans/Foundation/foundation.pdf',
            fileName: 'foundation.pdf',
            planType: 'foundation',
            version: 1,
            versionLabel: 'original',
            modifiedAt: '2026-03-01',
            confidence: 0.95,
          },
        },
        allVersions: [],
        missingTypes: [],
      })

      mockRunTradeExtractors.mockResolvedValue(extractions)
      for (const ext of extractions) {
        mockStoreExtraction.mockResolvedValueOnce(ext)
      }
    }

    it('creates takeoff_run with status=draft and source=structural_plan', async () => {
      const extraction = makeFoundationExtraction()
      setupFullPipeline([extraction])
      mockInsertTakeoffItems.mockResolvedValue({ inserted: 6, errors: [] })

      const events = [makeFileEvent()]
      await handleTakeoff(events, PROJECT_ID)

      expect(mockCreateTakeoffRun).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: PROJECT_ID,
          trade: 'Foundation (Pad Prep + PT Slab)',
          status: 'draft',
          name: expect.stringContaining('Foundation'),
        })
      )
    })

    it('maps foundation extraction to concrete/rebar/pier takeoff items', async () => {
      const extraction = makeFoundationExtraction()
      setupFullPipeline([extraction])
      mockInsertTakeoffItems.mockResolvedValue({ inserted: 6, errors: [] })

      const events = [makeFileEvent()]
      await handleTakeoff(events, PROJECT_ID)

      expect(mockInsertTakeoffItems).toHaveBeenCalledTimes(1)
      const items = mockInsertTakeoffItems.mock.calls[0][0] as Array<Record<string, unknown>>

      // Should have: Concrete Slab, Slab Perimeter Forms, Rebar, Post-Tension Cables, Pier/Footing, Vapor Barrier
      expect(items.length).toBe(6)

      const names = items.map(i => i.item_name)
      expect(names).toContain('Concrete Slab')
      expect(names).toContain('Slab Perimeter Forms')
      expect(names.some(n => (n as string).startsWith('Rebar'))).toBe(true)
      expect(names).toContain('Post-Tension Cables')
      expect(names).toContain('Pier/Footing')
      expect(names).toContain('Vapor Barrier')

      // Check that all items have structural_plan source
      for (const item of items) {
        expect(item.source).toBe('structural_plan')
        expect(item.confidence).toBe('calculated')
      }

      // Check specific quantities
      const slab = items.find(i => i.item_name === 'Concrete Slab')
      expect(slab?.quantity).toBe(85)
      expect(slab?.unit).toBe('CY')
    })

    it('maps framing extraction to wall/header/beam/sheathing items', async () => {
      // Use structural plan type to get framing extractors
      mockDiscoverLatestPlans.mockResolvedValue({
        plans: {
          structural: {
            fileId: 'file-002',
            filePath: '/Dropbox/Plans/Structural/framing.pdf',
            fileName: 'framing.pdf',
            planType: 'structural',
            version: 1,
            versionLabel: 'original',
            modifiedAt: '2026-03-01',
            confidence: 0.90,
          },
        },
        allVersions: [],
        missingTypes: [],
      })

      const framingExtraction = makeFramingExtraction('file-002')
      const roofingExtraction = makeRoofingExtraction('file-002')
      mockRunTradeExtractors.mockResolvedValue([framingExtraction, roofingExtraction])
      mockStoreExtraction
        .mockResolvedValueOnce(framingExtraction)
        .mockResolvedValueOnce(roofingExtraction)
      mockInsertTakeoffItems.mockResolvedValue({ inserted: 10, errors: [] })

      const events = [makeFileEvent()]
      await handleTakeoff(events, PROJECT_ID)

      // Should have been called for framing trade and roofing trade
      expect(mockInsertTakeoffItems).toHaveBeenCalled()

      // Gather all items across all calls
      const allItems: Array<Record<string, unknown>> = []
      for (const call of mockInsertTakeoffItems.mock.calls) {
        allItems.push(...(call[0] as Array<Record<string, unknown>>))
      }

      const names = allItems.map(i => i.item_name)
      // Framing items
      expect(names).toContain('Exterior Wall Framing')
      expect(names).toContain('Interior Wall Framing')
      expect(names.some(n => (n as string).startsWith('Header'))).toBe(true)
      expect(names.some(n => (n as string).startsWith('Beam'))).toBe(true)
      expect(names).toContain('Roof Sheathing')
      expect(names).toContain('Wall Sheathing')
      expect(names.some(n => (n as string).startsWith('Plates'))).toBe(true)
    })

    it('supersedes existing draft run for the same trade', async () => {
      const extraction = makeFoundationExtraction()
      setupFullPipeline([extraction])
      mockInsertTakeoffItems.mockResolvedValue({ inserted: 6, errors: [] })

      // Existing draft run for the same trade
      mockGetTakeoffRuns.mockResolvedValue([
        { id: 'old-run-001', project_id: PROJECT_ID, trade: 'Foundation (Pad Prep + PT Slab)', status: 'draft' },
      ])

      const events = [makeFileEvent()]
      await handleTakeoff(events, PROJECT_ID)

      // Old run should be superseded
      expect(mockUpdateTakeoffRunStatus).toHaveBeenCalledWith(
        'old-run-001',
        'superseded',
        'run-001' // the new run's id
      )
    })

    it('aggregates counts from all phases in the result', async () => {
      const extraction = makeFoundationExtraction()
      setupFullPipeline([extraction])
      mockInsertTakeoffItems.mockResolvedValue({ inserted: 6, errors: [] })

      const events = [makeFileEvent()]
      const result = await handleTakeoff(events, PROJECT_ID)

      // Phase A: 1 file cataloged
      // Phase D: 6 items + 1 run
      expect(result.records_created).toBe(1 + 6) // catalog + items
      expect(result.records_updated).toBe(1) // 1 run created
      expect(result.details).toContain('Cataloged 1 file(s)')
      expect(result.details).toContain('Extracted 1 plan(s)')
      expect(result.details).toContain('Created 6 takeoff items across 1 trade(s)')
    })
  })

  // ── Rate Limiting Test ────────────────────────────────────────────────

  describe('Rate limiting', () => {
    it('skips Phases B-D when no new file events', async () => {
      // Empty events array — no file events
      const result = await handleTakeoff([], PROJECT_ID)

      expect(mockDiscoverLatestPlans).not.toHaveBeenCalled()
      expect(mockRunTradeExtractors).not.toHaveBeenCalled()
      expect(mockCreateTakeoffRun).not.toHaveBeenCalled()
      expect(result.details).toBe('No plan files to catalog')
    })
  })

  // ── Error Handling ────────────────────────────────────────────────────

  describe('Error handling', () => {
    it('extraction failure for one plan does not block other plans', async () => {
      mockDiscoverLatestPlans.mockResolvedValue({
        plans: {
          foundation: {
            fileId: 'file-001',
            filePath: '/Dropbox/Plans/Foundation/foundation.pdf',
            fileName: 'foundation.pdf',
            planType: 'foundation',
            version: 1,
            versionLabel: 'original',
            modifiedAt: '2026-03-01',
            confidence: 0.95,
          },
          site: {
            fileId: 'file-003',
            filePath: '/Dropbox/Plans/Site/grading.pdf',
            fileName: 'grading.pdf',
            planType: 'site',
            version: 1,
            versionLabel: 'original',
            modifiedAt: '2026-03-01',
            confidence: 0.90,
          },
        },
        allVersions: [],
        missingTypes: [],
      })

      // Foundation extractor throws
      mockRunTradeExtractors
        .mockRejectedValueOnce(new Error('AI API rate limit exceeded'))
        .mockResolvedValueOnce([{
          id: 'ext-s-001',
          document_id: 'file-003',
          project_id: PROJECT_ID,
          extraction_type: 'site_work_takeoff',
          extracted_data: {
            earthwork: { cut_cy: 500, fill_cy: 300 },
          },
          confidence: 0.80,
          ai_notes: 'Site work extraction',
          reviewed: false,
        }])

      mockStoreExtraction.mockResolvedValue({
        id: 'ext-s-001',
        document_id: 'file-003',
        project_id: PROJECT_ID,
        extraction_type: 'site_work_takeoff',
        extracted_data: { earthwork: { cut_cy: 500, fill_cy: 300 } },
        confidence: 0.80,
        ai_notes: 'Site work extraction',
        reviewed: false,
      })

      mockInsertTakeoffItems.mockResolvedValue({ inserted: 2, errors: [] })

      const events = [makeFileEvent()]
      const result = await handleTakeoff(events, PROJECT_ID)

      // Should still process site plan despite foundation failure
      expect(result.errors.some(e => e.includes('AI API rate limit'))).toBe(true)
      // Site plan should have been extracted
      expect(mockStoreExtraction).toHaveBeenCalled()
    })
  })

  // ── Mapping Unit Tests ────────────────────────────────────────────────

  describe('mapExtractionToItems', () => {
    it('maps foundation_takeoff to concrete/rebar/pier items', () => {
      const extraction = makeFoundationExtraction()
      const items = mapExtractionToItems(extraction, 'run-001', PROJECT_ID)

      expect(items.length).toBe(6)
      expect(items.every(i => i.source === 'structural_plan')).toBe(true)
      expect(items.every(i => i.confidence === 'calculated')).toBe(true)
      expect(items.every(i => i.trade === 'Foundation (Pad Prep + PT Slab)')).toBe(true)

      const concreteSlab = items.find(i => i.item_name === 'Concrete Slab')
      expect(concreteSlab?.quantity).toBe(85)
      expect(concreteSlab?.unit).toBe('CY')
      expect(concreteSlab?.material_spec).toBe('3500 PSI')
    })

    it('maps framing_takeoff to wall/header/beam/sheathing items', () => {
      const extraction = makeFramingExtraction()
      const items = mapExtractionToItems(extraction, 'run-001', PROJECT_ID)

      // Exterior Wall + Interior Wall + 2 Headers + 1 Beam + Roof Sheathing + Wall Sheathing + Plates = 8
      expect(items.length).toBe(8)
      expect(items.every(i => i.trade === 'Framing (Lumber + Labor)')).toBe(true)

      const extWall = items.find(i => i.item_name === 'Exterior Wall Framing')
      expect(extWall?.quantity).toBe(520)
      expect(extWall?.unit).toBe('LF')

      const headers = items.filter(i => (i.item_name as string).startsWith('Header'))
      expect(headers.length).toBe(2)
      expect(headers[0].quantity).toBe(6)

      const beams = items.filter(i => (i.item_name as string).startsWith('Beam'))
      expect(beams.length).toBe(1)
      expect(beams[0].quantity).toBe(2)
    })

    it('maps roofing_takeoff to roof/ridge/flashing items', () => {
      const extraction = makeRoofingExtraction()
      const items = mapExtractionToItems(extraction, 'run-001', PROJECT_ID)

      // Roofing + Ridge Cap + Flashing + Drip Edge + Gutters + 2 Vents = 7
      expect(items.length).toBe(7)
      expect(items.every(i => i.trade === 'Roofing')).toBe(true)

      const roofing = items.find(i => (i.item_name as string).startsWith('Roofing'))
      expect(roofing?.quantity).toBe(9200)
      expect(roofing?.unit).toBe('SF')
      expect(roofing?.material_spec).toBe('standing seam metal')

      const vents = items.filter(i => (i.item_name as string).startsWith('Roof Vent'))
      expect(vents.length).toBe(2)
    })

    it('maps insulation_takeoff to wall/ceiling/foam items', () => {
      const extraction: DocumentExtraction = {
        document_id: 'file-004',
        project_id: PROJECT_ID,
        extraction_type: 'insulation_takeoff',
        extracted_data: {
          exterior_walls: { r_value: 'R-21', material: 'open-cell spray foam', area_sqft: 4800 },
          ceiling: { r_value: 'R-38', material: 'blown fiberglass', area_sqft: 7500 },
          rigid: { spec: '2" XPS R-10', area_sqft: 2000 },
          spray_foam: { area_sqft: 1200 },
        },
        confidence: 0.80,
        ai_notes: 'Insulation spec',
        reviewed: false,
      }

      const items = mapExtractionToItems(extraction, 'run-001', PROJECT_ID)
      expect(items.length).toBe(4)
      expect(items.every(i => i.trade === 'Insulation')).toBe(true)

      const extWallIns = items.find(i => (i.item_name as string).includes('Exterior Wall'))
      expect(extWallIns?.quantity).toBe(4800)
      expect(extWallIns?.material_spec).toBe('open-cell spray foam')

      const sprayFoam = items.find(i => i.item_name === 'Spray Foam')
      expect(sprayFoam?.quantity).toBe(1200)
    })

    it('maps site_work_takeoff to earthwork/driveway/utility items', () => {
      const extraction: DocumentExtraction = {
        document_id: 'file-005',
        project_id: PROJECT_ID,
        extraction_type: 'site_work_takeoff',
        extracted_data: {
          earthwork: { cut_cy: 500, fill_cy: 300 },
          driveway: { area_sqft: 2400, material: 'concrete' },
          utilities: [
            { type: 'water', trench_lf: 200 },
            { type: 'electric', trench_lf: 150 },
          ],
        },
        confidence: 0.85,
        ai_notes: 'Site work',
        reviewed: false,
      }

      const items = mapExtractionToItems(extraction, 'run-001', PROJECT_ID)
      expect(items.length).toBe(5)
      expect(items.every(i => i.trade === 'Site Clearing & Grading')).toBe(true)

      expect(items.find(i => i.item_name === 'Earthwork - Cut')?.quantity).toBe(500)
      expect(items.find(i => i.item_name === 'Earthwork - Fill')?.quantity).toBe(300)
      expect(items.find(i => (i.item_name as string).includes('concrete'))?.quantity).toBe(2400)

      const trenches = items.filter(i => (i.item_name as string).includes('Utility Trench'))
      expect(trenches.length).toBe(2)
    })

    it('maps window_door_schedule to window/door items', () => {
      const extraction: DocumentExtraction = {
        document_id: 'file-006',
        project_id: PROJECT_ID,
        extraction_type: 'window_door_schedule',
        extracted_data: {
          windows: [
            { mark: 'W1', width: 36, height: 48, type: 'double-hung', quantity: 4, room: 'Living Room' },
            { mark: 'W2', width: 60, height: 48, type: 'picture', quantity: 2, room: 'Primary Bedroom' },
          ],
          doors: [
            { mark: 'D1', width: 36, height: 80, type: 'entry', quantity: 1, location: 'Front Entry' },
            { mark: 'D2', width: 32, height: 80, type: 'interior', quantity: 8, location: 'Bedrooms' },
          ],
        },
        confidence: 0.90,
        ai_notes: 'Window/door schedule',
        reviewed: false,
      }

      const items = mapExtractionToItems(extraction, 'run-001', PROJECT_ID)
      expect(items.length).toBe(4)
      expect(items.every(i => i.trade === 'Windows & Doors')).toBe(true)

      const windows = items.filter(i => i.category === 'windows')
      expect(windows.length).toBe(2)
      expect(windows[0].item_name).toBe('double-hung Window W1 (36x48)')
      expect(windows[0].quantity).toBe(4)
      expect(windows[0].room).toBe('Living Room')

      const doors = items.filter(i => i.category === 'doors')
      expect(doors.length).toBe(2)
      expect(doors[0].item_name).toBe('entry Door D1 (36x80)')
      expect(doors[1].item_name).toBe('interior Door D2 (32x80)')
      expect(doors[1].quantity).toBe(8)
    })

    it('returns empty array for unknown extraction type', () => {
      const extraction: DocumentExtraction = {
        document_id: 'file-007',
        project_id: PROJECT_ID,
        extraction_type: 'general',
        extracted_data: { notes: 'Something' },
        confidence: 0.5,
        ai_notes: '',
        reviewed: false,
      }

      const items = mapExtractionToItems(extraction, 'run-001', PROJECT_ID)
      expect(items.length).toBe(0)
    })

    it('handles null/missing fields gracefully', () => {
      const extraction: DocumentExtraction = {
        document_id: 'file-008',
        project_id: PROJECT_ID,
        extraction_type: 'foundation_takeoff',
        extracted_data: {
          slab: { area_sqft: null, perimeter_lf: null, concrete_cy: null },
          rebar: null,
          post_tension: null,
          piers: [],
          vapor_barrier_sqft: null,
        },
        confidence: 0.3,
        ai_notes: 'Minimal data',
        reviewed: false,
      }

      const items = mapExtractionToItems(extraction, 'run-001', PROJECT_ID)
      // All null values should be skipped
      expect(items.length).toBe(0)
    })
  })

  // ── EXTRACTION_TO_TRADE Mapping ───────────────────────────────────────

  describe('EXTRACTION_TO_TRADE', () => {
    it('maps extraction types to correct trade names', () => {
      expect(EXTRACTION_TO_TRADE.foundation_takeoff).toBe('Foundation (Pad Prep + PT Slab)')
      expect(EXTRACTION_TO_TRADE.framing_takeoff).toBe('Framing (Lumber + Labor)')
      expect(EXTRACTION_TO_TRADE.roofing_takeoff).toBe('Roofing')
      expect(EXTRACTION_TO_TRADE.insulation_takeoff).toBe('Insulation')
      expect(EXTRACTION_TO_TRADE.site_work_takeoff).toBe('Site Clearing & Grading')
      expect(EXTRACTION_TO_TRADE.window_door_schedule).toBe('Windows & Doors')
    })
  })
})
