import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ──────────────────────────────────────────────────────────
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

import {
  getKnowledgeItems,
  getKnowledgeTree,
  getBlockers,
  getReadyItems,
  getDecisionPoints,
  getCascadingRequirements,
  getKnowledgeStateSummary,
  updateKnowledgeState,
  initializeProjectKnowledgeStates,
  isKnowledgeGraphSeeded,
  seedKnowledgeGraph,
} from './knowledge-graph'

// ── Test data ──────────────────────────────────────────────────────────────

function makeKnowledgeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ki-001',
    phase_number: 1,
    trade: 'Foundation',
    item_name: 'Foundation Engineering',
    item_type: 'task',
    parent_id: null,
    sort_order: 1,
    dependencies: [],
    triggers: [],
    materials: [],
    inspection_required: false,
    code_references: [],
    typical_duration_days: 14,
    typical_cost_range: { min: 2000, max: 5000 },
    decision_required: false,
    decision_options: null,
    description: 'Geotechnical report and structural foundation design',
    ...overrides,
  }
}

function makeProjectState(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pks-001',
    project_id: 'proj-001',
    knowledge_id: 'ki-001',
    status: 'pending',
    blocking_reason: null,
    actual_cost: null,
    completed_date: null,
    notes: null,
    ...overrides,
  }
}

/** Helper to set up chained mock responses for sequential Supabase calls */
function mockSequentialResponses(responses: Array<{ data?: unknown; error?: unknown; count?: unknown }>) {
  let callCount = 0
  Object.defineProperty(mockChain, 'then', {
    value: (resolve: (v: unknown) => void) => {
      const resp = responses[callCount] || responses[responses.length - 1]
      callCount++
      resolve({ data: resp.data ?? null, error: resp.error ?? null, count: resp.count ?? null })
    },
    writable: true,
    configurable: true,
  })
}

describe('Knowledge Graph Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  // ── getKnowledgeItems ────────────────────────────────────────────────

  describe('getKnowledgeItems', () => {
    it('fetches all knowledge items', async () => {
      const items = [makeKnowledgeItem(), makeKnowledgeItem({ id: 'ki-002', item_name: 'Well Drilling' })]
      mockSequentialResponses([{ data: items }])

      const result = await getKnowledgeItems()
      expect(result).toHaveLength(2)
      expect(mockChain.from).toHaveBeenCalledWith('construction_knowledge')
    })

    it('filters by phase_number', async () => {
      mockSequentialResponses([{ data: [makeKnowledgeItem()] }])

      await getKnowledgeItems({ phase_number: 1 })
      expect(mockChain.eq).toHaveBeenCalledWith('phase_number', 1)
    })

    it('filters by trade', async () => {
      mockSequentialResponses([{ data: [] }])

      await getKnowledgeItems({ trade: 'Framing' })
      expect(mockChain.eq).toHaveBeenCalledWith('trade', 'Framing')
    })

    it('returns empty array on error', async () => {
      mockSequentialResponses([{ data: null, error: { message: 'DB error' } }])

      const result = await getKnowledgeItems()
      expect(result).toEqual([])
    })
  })

  // ── getKnowledgeTree ─────────────────────────────────────────────────

  describe('getKnowledgeTree', () => {
    it('builds parent-child tree structure', async () => {
      const parent = makeKnowledgeItem({ id: 'ki-parent', item_name: 'Foundation' })
      const child = makeKnowledgeItem({ id: 'ki-child', item_name: 'Pad prep', parent_id: 'ki-parent' })

      mockSequentialResponses([
        { data: [parent, child] }, // getKnowledgeItems
        { data: [] },             // getProjectKnowledgeStates
      ])

      const tree = await getKnowledgeTree('proj-001')
      expect(tree).toHaveLength(1)
      expect(tree[0].item_name).toBe('Foundation')
      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children[0].item_name).toBe('Pad prep')
    })

    it('attaches project state to nodes', async () => {
      const item = makeKnowledgeItem({ id: 'ki-1' })
      const state = makeProjectState({ knowledge_id: 'ki-1', status: 'completed' })

      mockSequentialResponses([
        { data: [item] },   // getKnowledgeItems
        { data: [state] },  // getProjectKnowledgeStates
      ])

      const tree = await getKnowledgeTree('proj-001')
      expect(tree[0].state?.status).toBe('completed')
    })
  })

  // ── getBlockers ──────────────────────────────────────────────────────

  describe('getBlockers', () => {
    it('identifies blocked items with unmet dependencies', async () => {
      const dep = makeKnowledgeItem({ id: 'ki-dep', item_name: 'Prerequisite' })
      const blocked = makeKnowledgeItem({
        id: 'ki-blocked',
        item_name: 'Blocked Item',
        dependencies: ['ki-dep'],
      })
      const blockedState = makeProjectState({
        knowledge_id: 'ki-blocked',
        status: 'blocked',
      })
      const depState = makeProjectState({
        id: 'pks-dep',
        knowledge_id: 'ki-dep',
        status: 'pending',
      })

      mockSequentialResponses([
        { data: [dep, blocked] },              // getKnowledgeItems
        { data: [blockedState, depState] },    // getProjectKnowledgeStates
      ])

      const result = await getBlockers('proj-001')
      expect(result).toHaveLength(1)
      expect(result[0].item.item_name).toBe('Blocked Item')
      expect(result[0].unmetDependencies).toHaveLength(1)
      expect(result[0].unmetDependencies[0].item_name).toBe('Prerequisite')
    })

    it('returns empty when nothing is blocked', async () => {
      mockSequentialResponses([
        { data: [makeKnowledgeItem()] },
        { data: [makeProjectState({ status: 'completed' })] },
      ])

      const result = await getBlockers('proj-001')
      expect(result).toHaveLength(0)
    })
  })

  // ── getReadyItems ────────────────────────────────────────────────────

  describe('getReadyItems', () => {
    it('finds items with all dependencies completed', async () => {
      const dep = makeKnowledgeItem({ id: 'ki-dep', item_name: 'Done Task', dependencies: [] })
      const ready = makeKnowledgeItem({
        id: 'ki-ready',
        item_name: 'Ready Task',
        dependencies: ['ki-dep'],
      })
      const depState = makeProjectState({ knowledge_id: 'ki-dep', status: 'completed' })
      const readyState = makeProjectState({ id: 'pks-ready', knowledge_id: 'ki-ready', status: 'pending' })

      mockSequentialResponses([
        { data: [dep, ready] },
        { data: [depState, readyState] },
      ])

      const result = await getReadyItems('proj-001')
      expect(result.find(r => r.item_name === 'Ready Task')).toBeDefined()
    })

    it('does not return items with unmet dependencies', async () => {
      const dep = makeKnowledgeItem({ id: 'ki-dep', dependencies: [] })
      const notReady = makeKnowledgeItem({
        id: 'ki-not-ready',
        item_name: 'Not Ready',
        dependencies: ['ki-dep'],
      })
      const depState = makeProjectState({ knowledge_id: 'ki-dep', status: 'pending' })
      const notReadyState = makeProjectState({ id: 'pks-2', knowledge_id: 'ki-not-ready', status: 'pending' })

      mockSequentialResponses([
        { data: [dep, notReady] },
        { data: [depState, notReadyState] },
      ])

      const result = await getReadyItems('proj-001')
      expect(result.find(r => r.item_name === 'Not Ready')).toBeUndefined()
    })
  })

  // ── getDecisionPoints ────────────────────────────────────────────────

  describe('getDecisionPoints', () => {
    it('returns decision points with their state', async () => {
      const decision = makeKnowledgeItem({
        id: 'ki-decision',
        item_type: 'decision_point',
        item_name: 'Choose foundation type',
        decision_required: true,
        decision_options: [{ option: 'PT slab' }, { option: 'Pier and beam' }],
      })

      mockSequentialResponses([
        { data: [decision] }, // getKnowledgeItems with item_type filter
        { data: [] },         // getProjectKnowledgeStates
      ])

      const result = await getDecisionPoints('proj-001')
      expect(result).toHaveLength(1)
      expect(result[0].item.item_name).toBe('Choose foundation type')
      expect(result[0].state).toBeNull()
    })

    it('filters by phase number', async () => {
      mockSequentialResponses([
        { data: [] },
        { data: [] },
      ])

      await getDecisionPoints('proj-001', 2)
      // Should have been called with both phase_number and item_type filters
      expect(mockChain.eq).toHaveBeenCalledWith('item_type', 'decision_point')
      expect(mockChain.eq).toHaveBeenCalledWith('phase_number', 2)
    })
  })

  // ── getCascadingRequirements ──────────────────────────────────────────

  describe('getCascadingRequirements', () => {
    it('returns prerequisites, downstream, materials, inspections', async () => {
      const prereq = makeKnowledgeItem({
        id: 'ki-prereq',
        item_name: 'Rough wiring',
        item_type: 'task',
        materials: [{ name: 'Romex 14/2', unit: 'roll' }],
      })
      const main = makeKnowledgeItem({
        id: 'ki-main',
        item_name: 'Light fixture',
        dependencies: ['ki-prereq'],
        triggers: ['ki-inspection'],
      })
      const inspection = makeKnowledgeItem({
        id: 'ki-inspection',
        item_name: 'Electrical inspection',
        item_type: 'inspection',
        inspection_required: true,
      })

      mockSequentialResponses([
        { data: [prereq, main, inspection] },
      ])

      const result = await getCascadingRequirements('ki-main')
      expect(result.item.item_name).toBe('Light fixture')
      expect(result.prerequisites).toHaveLength(1)
      expect(result.prerequisites[0].item_name).toBe('Rough wiring')
      expect(result.downstream).toHaveLength(1)
      expect(result.downstream[0].item_name).toBe('Electrical inspection')
      expect(result.materials).toHaveLength(1)
      expect(result.materials[0].name).toBe('Romex 14/2')
      expect(result.inspections).toHaveLength(1)
    })

    it('includes children in downstream', async () => {
      const parent = makeKnowledgeItem({ id: 'ki-parent', item_name: 'HVAC Rough-In' })
      const child = makeKnowledgeItem({
        id: 'ki-child',
        item_name: 'Ductwork installation',
        parent_id: 'ki-parent',
      })

      mockSequentialResponses([
        { data: [parent, child] },
      ])

      const result = await getCascadingRequirements('ki-parent')
      expect(result.downstream.find(d => d.item_name === 'Ductwork installation')).toBeDefined()
    })

    it('throws for unknown item ID', async () => {
      mockSequentialResponses([{ data: [] }])

      await expect(getCascadingRequirements('unknown-id')).rejects.toThrow('Knowledge item not found')
    })
  })

  // ── getKnowledgeStateSummary ─────────────────────────────────────────

  describe('getKnowledgeStateSummary', () => {
    it('returns counts by status', async () => {
      const items = [
        makeKnowledgeItem({ id: 'ki-1' }),
        makeKnowledgeItem({ id: 'ki-2', decision_required: true }),
        makeKnowledgeItem({ id: 'ki-3' }),
      ]
      const states = [
        makeProjectState({ knowledge_id: 'ki-1', status: 'completed' }),
        makeProjectState({ id: 'pks-2', knowledge_id: 'ki-2', status: 'pending' }),
        makeProjectState({ id: 'pks-3', knowledge_id: 'ki-3', status: 'blocked' }),
      ]

      mockSequentialResponses([
        { data: items },  // getKnowledgeItems (for summary)
        { data: states }, // getProjectKnowledgeStates (for summary)
        { data: items },  // getKnowledgeItems (for getReadyItems)
        { data: states }, // getProjectKnowledgeStates (for getReadyItems)
      ])

      const result = await getKnowledgeStateSummary('proj-001')
      expect(result.totalItems).toBe(3)
      expect(result.completed).toBe(1)
      expect(result.blocked).toBe(1)
      expect(result.decisionsPending).toBe(1)
    })
  })

  // ── updateKnowledgeState ─────────────────────────────────────────────

  describe('updateKnowledgeState', () => {
    it('upserts state for a non-completion update', async () => {
      const updated = makeProjectState({ status: 'in_progress' })
      mockChain.single.mockResolvedValueOnce({ data: updated, error: null })

      const result = await updateKnowledgeState('proj-001', 'ki-001', {
        status: 'in_progress',
      })

      expect(result).toBeDefined()
      expect(result?.status).toBe('in_progress')
      expect(mockChain.upsert).toHaveBeenCalled()
    })

    it('triggers downstream updates on completion', async () => {
      const updated = makeProjectState({ status: 'completed' })
      mockChain.single.mockResolvedValueOnce({ data: updated, error: null })

      // Mock for updateTriggeredItems
      mockSequentialResponses([
        { data: [] }, // getKnowledgeItems
        { data: [] }, // getProjectKnowledgeStates
      ])

      const result = await updateKnowledgeState('proj-001', 'ki-001', {
        status: 'completed',
        completed_date: '2026-03-14',
      })

      expect(result?.status).toBe('completed')
    })

    it('returns null on error', async () => {
      mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'Error' } })

      const result = await updateKnowledgeState('proj-001', 'ki-001', { status: 'completed' })
      expect(result).toBeNull()
    })
  })

  // ── initializeProjectKnowledgeStates ─────────────────────────────────

  describe('initializeProjectKnowledgeStates', () => {
    it('creates states for untracked items', async () => {
      const items = [
        makeKnowledgeItem({ id: 'ki-1' }),
        makeKnowledgeItem({ id: 'ki-2' }),
      ]

      mockSequentialResponses([
        { data: items },  // getKnowledgeItems
        { data: [] },     // getProjectKnowledgeStates (empty = none tracked)
        { data: null },   // insert
      ])

      const count = await initializeProjectKnowledgeStates('proj-001')
      expect(count).toBe(2)
      expect(mockChain.insert).toHaveBeenCalled()
    })

    it('skips already tracked items', async () => {
      const items = [makeKnowledgeItem({ id: 'ki-1' })]
      const existing = [makeProjectState({ knowledge_id: 'ki-1' })]

      mockSequentialResponses([
        { data: items },
        { data: existing },
      ])

      const count = await initializeProjectKnowledgeStates('proj-001')
      expect(count).toBe(0)
    })
  })

  // ── isKnowledgeGraphSeeded ───────────────────────────────────────────

  describe('isKnowledgeGraphSeeded', () => {
    it('returns true when items exist', async () => {
      mockSequentialResponses([{ count: 150 }])

      const result = await isKnowledgeGraphSeeded()
      expect(result).toBe(true)
    })

    it('returns false when empty', async () => {
      mockSequentialResponses([{ count: 0 }])

      const result = await isKnowledgeGraphSeeded()
      expect(result).toBe(false)
    })
  })

  // ── seedKnowledgeGraph ───────────────────────────────────────────────

  describe('seedKnowledgeGraph', () => {
    it('inserts seed items and their children', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'new-id' }, error: null })

      const seedData = [{
        phase_number: 1,
        trade: 'Test Trade',
        item_name: 'Parent Item',
        item_type: 'task' as const,
        sort_order: 1,
        children: [{
          item_name: 'Child Item',
          item_type: 'task' as const,
          sort_order: 1,
        }],
      }]

      const result = await seedKnowledgeGraph(seedData)
      expect(result.created).toBe(2)
      expect(result.errors).toHaveLength(0)
    })

    it('records errors for failed inserts', async () => {
      mockChain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } })

      const seedData = [{
        phase_number: 1,
        trade: 'Test',
        item_name: 'Failing Item',
        item_type: 'task' as const,
        sort_order: 1,
      }]

      const result = await seedKnowledgeGraph(seedData)
      expect(result.created).toBe(0)
      expect(result.errors).toHaveLength(1)
    })
  })
})
