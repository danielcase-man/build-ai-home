import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSelection } from '@/test/helpers'

const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'insert', 'update', 'eq', 'order', 'single', 'from'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

import { getSelections, getSelectionsByCategory, updateSelection, createSelection } from './selections-service'

describe('getSelections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  it('returns selections ordered by room, category, subcategory', async () => {
    const selections = [makeSelection()]
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: selections, error: null }),
      writable: true, configurable: true,
    })

    const result = await getSelections('proj-1')
    expect(result).toHaveLength(1)
    expect(mockChain.order).toHaveBeenCalledWith('room', { ascending: true })
  })

  it('returns empty array on error', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'fail' } }),
      writable: true, configurable: true,
    })

    const result = await getSelections('proj-1')
    expect(result).toEqual([])
  })
})

describe('getSelectionsByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  it('filters by category', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: [makeSelection({ category: 'plumbing' })], error: null }),
      writable: true, configurable: true,
    })

    const result = await getSelectionsByCategory('proj-1', 'plumbing')
    expect(result).toHaveLength(1)
    // eq called for project_id and category
    expect(mockChain.eq).toHaveBeenCalledWith('project_id', 'proj-1')
    expect(mockChain.eq).toHaveBeenCalledWith('category', 'plumbing')
  })
})

describe('updateSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  it('updates and returns selection', async () => {
    const updated = makeSelection({ status: 'selected' })
    mockChain.single.mockResolvedValueOnce({ data: updated, error: null })

    const result = await updateSelection('sel-1', { status: 'selected' })
    expect(result).toEqual(updated)
    expect(mockChain.update).toHaveBeenCalledWith({ status: 'selected' })
  })

  it('returns null on error', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })

    const result = await updateSelection('sel-1', { status: 'selected' })
    expect(result).toBeNull()
  })
})

describe('createSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  it('creates and returns selection', async () => {
    const created = makeSelection()
    mockChain.single.mockResolvedValueOnce({ data: created, error: null })

    const { id, created_at, updated_at, ...input } = makeSelection()
    const result = await createSelection(input)
    expect(result).toEqual(created)
  })

  it('returns null on error', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'conflict' } })

    const { id, created_at, updated_at, ...input } = makeSelection()
    const result = await createSelection(input)
    expect(result).toBeNull()
  })
})
