import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSelection } from '@/test/helpers'
import type { TakeoffRun, TakeoffRunWithItems, Selection } from '@/types'
import type { CategoryMapping } from './category-mapping'

// ─── Mocks ────────────────────────────────────────────────────────────────

vi.mock('./selections-service', () => ({
  getSelectionsByCategory: vi.fn(),
}))

vi.mock('./category-mapping', () => ({
  getCategoryMapping: vi.fn(),
  getAllCategoryMappings: vi.fn(),
}))

vi.mock('./takeoff-service', () => ({
  createTakeoffRun: vi.fn(),
  insertTakeoffItems: vi.fn(),
  getTakeoffRuns: vi.fn(),
  updateTakeoffRunStatus: vi.fn(),
  getTakeoffRunWithItems: vi.fn(),
}))

import {
  generateFinishTakeoff,
  generateAllFinishTakeoffs,
  getCurrentTakeoff,
} from './takeoff-generator-service'

import { getSelectionsByCategory } from './selections-service'
import { getCategoryMapping, getAllCategoryMappings } from './category-mapping'
import {
  createTakeoffRun,
  insertTakeoffItems,
  getTakeoffRuns,
  updateTakeoffRunStatus,
  getTakeoffRunWithItems,
} from './takeoff-service'

// ─── Typed mocks ──────────────────────────────────────────────────────────

const mockGetSelectionsByCategory = getSelectionsByCategory as ReturnType<typeof vi.fn>
const mockGetCategoryMapping = getCategoryMapping as ReturnType<typeof vi.fn>
const mockGetAllCategoryMappings = getAllCategoryMappings as ReturnType<typeof vi.fn>
const mockCreateTakeoffRun = createTakeoffRun as ReturnType<typeof vi.fn>
const mockInsertTakeoffItems = insertTakeoffItems as ReturnType<typeof vi.fn>
const mockGetTakeoffRuns = getTakeoffRuns as ReturnType<typeof vi.fn>
const mockUpdateTakeoffRunStatus = updateTakeoffRunStatus as ReturnType<typeof vi.fn>
const mockGetTakeoffRunWithItems = getTakeoffRunWithItems as ReturnType<typeof vi.fn>

// ─── Test Data ────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-001'

const plumbingMapping: CategoryMapping = {
  selectionCategory: 'plumbing',
  bidCategory: 'Plumbing Fixtures',
  knowledgeTrade: 'Plumbing Fixtures',
  phase: 7,
}

const lightingMapping: CategoryMapping = {
  selectionCategory: 'lighting',
  bidCategory: 'Lighting Fixtures',
  knowledgeTrade: 'Lighting Fixtures',
  phase: 7,
}

const plumbingSelections: Selection[] = [
  makeSelection({
    id: 'sel-1',
    room: 'Primary Bathroom',
    category: 'plumbing',
    product_name: 'Delta Trinsic Faucet',
    brand: 'Delta',
    collection: 'Trinsic',
    model_number: '559HA-BL-DST',
    finish: 'Matte Black',
    color: undefined,
    quantity: 2,
    unit_price: 320,
    total_price: 640,
  }),
  makeSelection({
    id: 'sel-2',
    room: 'Primary Bathroom',
    category: 'plumbing',
    product_name: 'Kohler Underscore Tub',
    brand: 'Kohler',
    collection: undefined,
    model_number: 'K-1121-0',
    finish: 'White',
    color: undefined,
    quantity: 1,
    unit_price: 1850,
    total_price: 1850,
  }),
  makeSelection({
    id: 'sel-3',
    room: 'Kitchen',
    category: 'plumbing',
    product_name: 'InSinkErator Disposal',
    brand: 'InSinkErator',
    collection: undefined,
    model_number: 'PRO1100XL',
    finish: undefined,
    color: undefined,
    quantity: 1,
    unit_price: 350,
    total_price: 350,
  }),
]

const createdRun: TakeoffRun = {
  id: 'run-new',
  project_id: PROJECT_ID,
  trade: 'Plumbing Fixtures',
  name: 'Plumbing Fixtures — Finish Selections',
  description: 'Auto-generated from 3 plumbing selections',
  confidence_pct: 100,
  gaps: [],
  status: 'final',
  created_at: '2026-03-29T00:00:00Z',
}

// ─── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockInsertTakeoffItems.mockResolvedValue({ inserted: 0, errors: [] })
  mockUpdateTakeoffRunStatus.mockResolvedValue(true)
})

// ─── Tests ────────────────────────────────────────────────────────────────

describe('generateFinishTakeoff', () => {
  it('creates a run with correctly mapped items from 3 plumbing selections', async () => {
    mockGetSelectionsByCategory.mockResolvedValue(plumbingSelections)
    mockGetCategoryMapping.mockReturnValue(plumbingMapping)
    mockGetTakeoffRuns.mockResolvedValue([])
    mockCreateTakeoffRun.mockResolvedValue(createdRun)
    mockInsertTakeoffItems.mockResolvedValue({ inserted: 3, errors: [] })

    const result = await generateFinishTakeoff(PROJECT_ID, 'plumbing')

    // Run was created with correct trade/name
    expect(mockCreateTakeoffRun).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: PROJECT_ID,
        trade: 'Plumbing Fixtures',
        name: 'Plumbing Fixtures — Finish Selections',
        status: 'final',
        confidence_pct: 100,
      })
    )

    // Items were inserted
    expect(mockInsertTakeoffItems).toHaveBeenCalledTimes(1)
    const insertedItems = mockInsertTakeoffItems.mock.calls[0][0]
    expect(insertedItems).toHaveLength(3)

    // First item field mapping
    const item0 = insertedItems[0]
    expect(item0.takeoff_run_id).toBe('run-new')
    expect(item0.project_id).toBe(PROJECT_ID)
    expect(item0.category).toBe('plumbing')
    expect(item0.trade).toBe('Plumbing Fixtures')
    expect(item0.item_name).toBe('Delta Trinsic Faucet')
    expect(item0.description).toBe('Delta — Trinsic — Matte Black')
    expect(item0.material_spec).toBe('Delta 559HA-BL-DST')
    expect(item0.quantity).toBe(2)
    expect(item0.unit).toBe('EA')
    expect(item0.unit_cost).toBe(320)
    expect(item0.total_cost).toBe(640)
    expect(item0.source).toBe('vendor_spec')
    expect(item0.confidence).toBe('verified')
    expect(item0.source_detail).toBe('Selection: Primary Bathroom — Delta Trinsic Faucet')
    expect(item0.selection_id).toBe('sel-1')
    expect(item0.room).toBe('Primary Bathroom')

    // Third item — verify sparse fields produce correct description/material_spec
    const item2 = insertedItems[2]
    expect(item2.item_name).toBe('InSinkErator Disposal')
    expect(item2.description).toBe('InSinkErator')
    expect(item2.material_spec).toBe('InSinkErator PRO1100XL')
    expect(item2.selection_id).toBe('sel-3')
    expect(item2.room).toBe('Kitchen')

    expect(result).toEqual(createdRun)
  })

  it('supersedes an existing run when one is active', async () => {
    const existingRun: TakeoffRun = {
      id: 'run-old',
      project_id: PROJECT_ID,
      trade: 'Plumbing Fixtures',
      name: 'Old run',
      status: 'final',
    }

    mockGetSelectionsByCategory.mockResolvedValue(plumbingSelections)
    mockGetCategoryMapping.mockReturnValue(plumbingMapping)
    mockGetTakeoffRuns.mockResolvedValue([existingRun])
    mockCreateTakeoffRun.mockResolvedValue(createdRun)
    mockInsertTakeoffItems.mockResolvedValue({ inserted: 3, errors: [] })

    await generateFinishTakeoff(PROJECT_ID, 'plumbing')

    // Old run was superseded
    expect(mockUpdateTakeoffRunStatus).toHaveBeenCalledWith('run-old', 'superseded')

    // New run was still created
    expect(mockCreateTakeoffRun).toHaveBeenCalledTimes(1)
  })

  it('returns null when no selections exist for category', async () => {
    mockGetSelectionsByCategory.mockResolvedValue([])

    const result = await generateFinishTakeoff(PROJECT_ID, 'plumbing')

    expect(result).toBeNull()
    expect(mockCreateTakeoffRun).not.toHaveBeenCalled()
    expect(mockInsertTakeoffItems).not.toHaveBeenCalled()
  })
})

describe('generateAllFinishTakeoffs', () => {
  it('calls generateFinishTakeoff for each category mapping', async () => {
    const mappings: CategoryMapping[] = [plumbingMapping, lightingMapping]
    mockGetAllCategoryMappings.mockReturnValue(mappings)

    // Plumbing has selections, lighting does not
    mockGetSelectionsByCategory
      .mockResolvedValueOnce(plumbingSelections) // first call for generateFinishTakeoff('plumbing')
      .mockResolvedValueOnce(plumbingSelections) // second call inside generateAllFinishTakeoffs to count items
      .mockResolvedValueOnce([])                 // generateFinishTakeoff('lighting') — returns null

    mockGetCategoryMapping
      .mockReturnValueOnce(plumbingMapping)

    mockGetTakeoffRuns.mockResolvedValue([])
    mockCreateTakeoffRun.mockResolvedValue(createdRun)
    mockInsertTakeoffItems.mockResolvedValue({ inserted: 3, errors: [] })

    const result = await generateAllFinishTakeoffs(PROJECT_ID)

    expect(result.runs).toHaveLength(1)
    expect(result.runs[0]).toEqual(createdRun)
    expect(result.totalItems).toBe(3)
  })
})

describe('getCurrentTakeoff', () => {
  it('returns the latest non-superseded run with items', async () => {
    const activeRun: TakeoffRun = {
      id: 'run-active',
      project_id: PROJECT_ID,
      trade: 'Plumbing Fixtures',
      name: 'Current run',
      status: 'final',
    }

    const runWithItems: TakeoffRunWithItems = {
      ...activeRun,
      items: [
        {
          id: 'item-1',
          takeoff_run_id: 'run-active',
          project_id: PROJECT_ID,
          category: 'plumbing',
          trade: 'Plumbing Fixtures',
          item_name: 'Delta Faucet',
          quantity: 1,
          unit: 'EA',
          source: 'vendor_spec',
          confidence: 'verified',
        },
      ],
    }

    mockGetTakeoffRuns.mockResolvedValue([
      activeRun,
      { ...activeRun, id: 'run-old', status: 'superseded' },
    ])
    mockGetTakeoffRunWithItems.mockResolvedValue(runWithItems)

    const result = await getCurrentTakeoff(PROJECT_ID, 'Plumbing Fixtures')

    expect(mockGetTakeoffRuns).toHaveBeenCalledWith(PROJECT_ID, { trade: 'Plumbing Fixtures' })
    expect(mockGetTakeoffRunWithItems).toHaveBeenCalledWith('run-active')
    expect(result).toEqual(runWithItems)
  })

  it('returns null when no active run exists', async () => {
    mockGetTakeoffRuns.mockResolvedValue([
      { id: 'run-old', status: 'superseded', trade: 'Plumbing Fixtures' },
    ])

    const result = await getCurrentTakeoff(PROJECT_ID, 'Plumbing Fixtures')

    expect(result).toBeNull()
    expect(mockGetTakeoffRunWithItems).not.toHaveBeenCalled()
  })
})
