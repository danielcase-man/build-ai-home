import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock supabase
const mockChain: Record<string, ReturnType<typeof vi.fn>> = {}
for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'gte', 'order', 'limit', 'single', 'from', 'is'] as const) {
  mockChain[m] = vi.fn()
}
for (const m of Object.keys(mockChain)) {
  mockChain[m].mockReturnValue(mockChain)
}

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockChain.from(...args) },
}))

// Mock knowledge-graph service
const mockGetKnowledgeItems = vi.fn().mockResolvedValue([])
const mockGetBlockers = vi.fn().mockResolvedValue([])
const mockGetReadyItems = vi.fn().mockResolvedValue([])
const mockGetDecisionPoints = vi.fn().mockResolvedValue([])
const mockGetKnowledgeStateSummary = vi.fn().mockResolvedValue({
  totalItems: 0, completed: 0, inProgress: 0, blocked: 0, ready: 0, pending: 0, decisionsPending: 0,
})
const mockGetProjectKnowledgeStates = vi.fn().mockResolvedValue([])
const mockUpdateKnowledgeState = vi.fn().mockResolvedValue(null)
const mockInitializeProjectKnowledgeStates = vi.fn().mockResolvedValue(0)
const mockGetKnowledgeTree = vi.fn().mockResolvedValue([])

vi.mock('./knowledge-graph', () => ({
  getKnowledgeItems: (...args: unknown[]) => mockGetKnowledgeItems(...args),
  getKnowledgeTree: (...args: unknown[]) => mockGetKnowledgeTree(...args),
  getBlockers: (...args: unknown[]) => mockGetBlockers(...args),
  getReadyItems: (...args: unknown[]) => mockGetReadyItems(...args),
  getDecisionPoints: (...args: unknown[]) => mockGetDecisionPoints(...args),
  getKnowledgeStateSummary: (...args: unknown[]) => mockGetKnowledgeStateSummary(...args),
  getProjectKnowledgeStates: (...args: unknown[]) => mockGetProjectKnowledgeStates(...args),
  updateKnowledgeState: (...args: unknown[]) => mockUpdateKnowledgeState(...args),
  initializeProjectKnowledgeStates: (...args: unknown[]) => mockInitializeProjectKnowledgeStates(...args),
}))

import {
  getWorkflowOverview,
  getActivePhase,
  getPhaseChecklist,
  getUpcomingDecisions,
  getWorkflowAlerts,
  startWorkflowItem,
  completeWorkflowItem,
  blockWorkflowItem,
  recordDecision,
  ensureWorkflowInitialized,
} from './workflow-service'

// ── Test helpers ───────────────────────────────────────────────────────────

function makeItem(overrides: Record<string, unknown> = {}) {
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

function makeState(overrides: Record<string, unknown> = {}) {
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

describe('Workflow Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const m of Object.keys(mockChain)) {
      mockChain[m].mockReturnValue(mockChain)
    }
  })

  // ── getWorkflowOverview ──────────────────────────────────────────────

  describe('getWorkflowOverview', () => {
    it('returns phases with correct status', async () => {
      const items = [
        makeItem({ id: 'ki-1', phase_number: 1, item_name: 'Item 1' }),
        makeItem({ id: 'ki-2', phase_number: 1, item_name: 'Item 2' }),
        makeItem({ id: 'ki-3', phase_number: 2, item_name: 'Item 3' }),
      ]
      const states = [
        makeState({ knowledge_id: 'ki-1', status: 'completed' }),
        makeState({ id: 'pks-2', knowledge_id: 'ki-2', status: 'in_progress' }),
        makeState({ id: 'pks-3', knowledge_id: 'ki-3', status: 'pending' }),
      ]

      mockGetKnowledgeItems.mockResolvedValue(items)
      mockGetProjectKnowledgeStates.mockResolvedValue(states)
      mockGetKnowledgeStateSummary.mockResolvedValue({
        totalItems: 3, completed: 1, inProgress: 1, blocked: 0, ready: 0, pending: 1, decisionsPending: 0,
      })
      mockGetBlockers.mockResolvedValue([])
      mockGetReadyItems.mockResolvedValue([])
      mockGetDecisionPoints.mockResolvedValue([])

      const overview = await getWorkflowOverview('proj-001')
      expect(overview.phases).toHaveLength(8)
      expect(overview.phases[0].status).toBe('active') // Phase 1 has completed + in_progress
      expect(overview.phases[0].completed_items).toBe(1)
      expect(overview.phases[1].status).toBe('not_started') // Phase 2 has only pending
      expect(overview.stats.totalItems).toBe(3)
    })

    it('marks phase completed when all items done', async () => {
      const items = [
        makeItem({ id: 'ki-1', phase_number: 3 }),
      ]
      const states = [
        makeState({ knowledge_id: 'ki-1', status: 'completed' }),
      ]

      mockGetKnowledgeItems.mockResolvedValue(items)
      mockGetProjectKnowledgeStates.mockResolvedValue(states)
      mockGetKnowledgeStateSummary.mockResolvedValue({
        totalItems: 1, completed: 1, inProgress: 0, blocked: 0, ready: 0, pending: 0, decisionsPending: 0,
      })
      mockGetBlockers.mockResolvedValue([])
      mockGetReadyItems.mockResolvedValue([])
      mockGetDecisionPoints.mockResolvedValue([])

      const overview = await getWorkflowOverview('proj-001')
      expect(overview.phases[2].status).toBe('completed') // Phase 3
      expect(overview.phases[2].progress_percentage).toBe(100)
    })
  })

  // ── getActivePhase ───────────────────────────────────────────────────

  describe('getActivePhase', () => {
    it('returns the first active phase', async () => {
      mockGetKnowledgeItems.mockResolvedValue([
        makeItem({ id: 'ki-1', phase_number: 2 }),
      ])
      mockGetProjectKnowledgeStates.mockResolvedValue([
        makeState({ knowledge_id: 'ki-1', status: 'in_progress' }),
      ])
      mockGetKnowledgeStateSummary.mockResolvedValue({
        totalItems: 1, completed: 0, inProgress: 1, blocked: 0, ready: 0, pending: 0, decisionsPending: 0,
      })
      mockGetBlockers.mockResolvedValue([])
      mockGetReadyItems.mockResolvedValue([])
      mockGetDecisionPoints.mockResolvedValue([])

      const phase = await getActivePhase('proj-001')
      expect(phase).toBeDefined()
      expect(phase?.phase_number).toBe(2)
      expect(phase?.status).toBe('active')
    })

    it('returns first not_started phase when none active', async () => {
      mockGetKnowledgeItems.mockResolvedValue([])
      mockGetProjectKnowledgeStates.mockResolvedValue([])
      mockGetKnowledgeStateSummary.mockResolvedValue({
        totalItems: 0, completed: 0, inProgress: 0, blocked: 0, ready: 0, pending: 0, decisionsPending: 0,
      })
      mockGetBlockers.mockResolvedValue([])
      mockGetReadyItems.mockResolvedValue([])
      mockGetDecisionPoints.mockResolvedValue([])

      const phase = await getActivePhase('proj-001')
      expect(phase?.status).toBe('not_started')
    })
  })

  // ── getPhaseChecklist ────────────────────────────────────────────────

  describe('getPhaseChecklist', () => {
    it('delegates to getKnowledgeTree with phase filter', async () => {
      mockGetKnowledgeTree.mockResolvedValue([])

      await getPhaseChecklist('proj-001', 3)
      expect(mockGetKnowledgeTree).toHaveBeenCalledWith('proj-001', { phase_number: 3 })
    })
  })

  // ── getUpcomingDecisions ─────────────────────────────────────────────

  describe('getUpcomingDecisions', () => {
    it('returns only pending/ready decisions', async () => {
      mockGetDecisionPoints.mockResolvedValue([
        { item: makeItem({ id: 'ki-d1', item_type: 'decision_point' }), state: makeState({ status: 'pending' }) },
        { item: makeItem({ id: 'ki-d2', item_type: 'decision_point' }), state: makeState({ status: 'completed' }) },
        { item: makeItem({ id: 'ki-d3', item_type: 'decision_point' }), state: null },
      ])

      const decisions = await getUpcomingDecisions('proj-001')
      expect(decisions).toHaveLength(2) // pending + null state
    })
  })

  // ── getWorkflowAlerts ────────────────────────────────────────────────

  describe('getWorkflowAlerts', () => {
    it('generates alerts for blockers', async () => {
      mockGetBlockers.mockResolvedValue([{
        item: makeItem({ id: 'ki-blocked', item_name: 'Concrete Pour', phase_number: 2 }),
        state: makeState({ status: 'blocked', blocking_reason: 'Weather' }),
        unmetDependencies: [makeItem({ id: 'ki-dep', item_name: 'Pad Prep' })],
      }])
      mockGetReadyItems.mockResolvedValue([])
      mockGetDecisionPoints.mockResolvedValue([])

      const alerts = await getWorkflowAlerts('proj-001')
      expect(alerts.some(a => a.type === 'blocker')).toBe(true)
      expect(alerts[0].title).toContain('Concrete Pour')
      expect(alerts[0].priority).toBe('high')
    })

    it('generates alerts for pending decisions', async () => {
      mockGetBlockers.mockResolvedValue([])
      mockGetReadyItems.mockResolvedValue([])
      mockGetDecisionPoints.mockResolvedValue([{
        item: makeItem({ id: 'ki-decision', item_name: 'Choose roofing material', item_type: 'decision_point', description: 'Pick shingles or metal' }),
        state: makeState({ status: 'ready' }),
      }])

      const alerts = await getWorkflowAlerts('proj-001')
      expect(alerts.some(a => a.type === 'decision_needed')).toBe(true)
    })

    it('generates alerts for ready items', async () => {
      mockGetBlockers.mockResolvedValue([])
      mockGetDecisionPoints.mockResolvedValue([])
      mockGetReadyItems.mockResolvedValue([
        makeItem({ id: 'ki-ready', item_name: 'Wall framing', typical_duration_days: 10, trade: 'Framing' }),
      ])

      const alerts = await getWorkflowAlerts('proj-001')
      expect(alerts.some(a => a.type === 'ready_to_start')).toBe(true)
      expect(alerts.find(a => a.type === 'ready_to_start')?.message).toContain('10 days')
    })

    it('sorts alerts by priority (high first)', async () => {
      mockGetBlockers.mockResolvedValue([{
        item: makeItem({ id: 'ki-b' }),
        state: makeState({ status: 'blocked' }),
        unmetDependencies: [],
      }])
      mockGetDecisionPoints.mockResolvedValue([{
        item: makeItem({ id: 'ki-d', item_type: 'decision_point' }),
        state: null,
      }])
      mockGetReadyItems.mockResolvedValue([makeItem({ id: 'ki-r' })])

      const alerts = await getWorkflowAlerts('proj-001')
      expect(alerts[0].priority).toBe('high')
      expect(alerts[alerts.length - 1].priority).toBe('low')
    })
  })

  // ── Write operations ─────────────────────────────────────────────────

  describe('startWorkflowItem', () => {
    it('calls updateKnowledgeState with in_progress', async () => {
      mockUpdateKnowledgeState.mockResolvedValue(makeState({ status: 'in_progress' }))

      const result = await startWorkflowItem('proj-001', 'ki-001')
      expect(mockUpdateKnowledgeState).toHaveBeenCalledWith('proj-001', 'ki-001', { status: 'in_progress' })
      expect(result?.status).toBe('in_progress')
    })
  })

  describe('completeWorkflowItem', () => {
    it('calls updateKnowledgeState with completed status and details', async () => {
      const completed = makeState({ status: 'completed', completed_date: '2026-03-14', actual_cost: 5000 })
      mockUpdateKnowledgeState.mockResolvedValue(completed)

      const result = await completeWorkflowItem('proj-001', 'ki-001', {
        completedDate: '2026-03-14',
        actualCost: 5000,
        notes: 'Done',
      })

      expect(mockUpdateKnowledgeState).toHaveBeenCalledWith('proj-001', 'ki-001', {
        status: 'completed',
        completed_date: '2026-03-14',
        actual_cost: 5000,
        notes: 'Done',
      })
      expect(result?.status).toBe('completed')
    })
  })

  describe('blockWorkflowItem', () => {
    it('sets blocked status with reason', async () => {
      mockUpdateKnowledgeState.mockResolvedValue(makeState({ status: 'blocked', blocking_reason: 'Weather delay' }))

      const result = await blockWorkflowItem('proj-001', 'ki-001', 'Weather delay')
      expect(mockUpdateKnowledgeState).toHaveBeenCalledWith('proj-001', 'ki-001', {
        status: 'blocked',
        blocking_reason: 'Weather delay',
      })
      expect(result?.status).toBe('blocked')
    })
  })

  describe('recordDecision', () => {
    it('records decision with selected option in notes', async () => {
      mockUpdateKnowledgeState.mockResolvedValue(makeState({ status: 'completed' }))

      await recordDecision('proj-001', 'ki-001', 'Post-tension slab', 'Best for our soil')
      expect(mockUpdateKnowledgeState).toHaveBeenCalledWith('proj-001', 'ki-001', expect.objectContaining({
        status: 'completed',
        notes: 'Decision: Post-tension slab — Best for our soil',
      }))
    })
  })

  describe('ensureWorkflowInitialized', () => {
    it('delegates to initializeProjectKnowledgeStates', async () => {
      mockInitializeProjectKnowledgeStates.mockResolvedValue(42)

      const count = await ensureWorkflowInitialized('proj-001')
      expect(count).toBe(42)
      expect(mockInitializeProjectKnowledgeStates).toHaveBeenCalledWith('proj-001')
    })
  })
})
