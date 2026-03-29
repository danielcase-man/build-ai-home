import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub React cache() before importing — it's a server-only API
vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}))

// ─── Supabase chainable mock ─────────────────────────────────────────────────
// Use vi.hoisted so the mock variables are available inside vi.mock factories.
const { mockChain, CHAIN_METHODS, mockResult } = vi.hoisted(() => {
  const mockResult = { current: { data: null, error: null, count: null } as any }
  const chain: Record<string, any> = {}
  const methods = [
    'from', 'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'not', 'in', 'gte', 'lte', 'order', 'limit', 'single', 'maybeSingle',
  ] as const
  return { mockChain: chain, CHAIN_METHODS: methods, mockResult }
})

vi.mock('./supabase', () => {
  for (const m of CHAIN_METHODS) {
    mockChain[m] = vi.fn().mockReturnValue(mockChain)
  }
  mockChain.single = vi.fn().mockImplementation(() => Promise.resolve(mockResult.current))
  Object.defineProperty(mockChain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve(mockResult.current),
    writable: true,
    configurable: true,
  })
  return { supabase: { from: (...args: unknown[]) => mockChain.from(...args) } }
})

// Mock modules imported by project-service but not under test
vi.mock('./database', () => ({
  db: {
    getLatestProjectStatus: vi.fn().mockResolvedValue(null),
    getRecentEmails: vi.fn().mockResolvedValue([]),
    upsertProjectStatus: vi.fn().mockResolvedValue(undefined),
    syncAIInsightsToTasks: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('./ai-summarization', () => ({
  generateProjectStatusSnapshot: vi.fn().mockResolvedValue({
    hot_topics: [],
    action_items: [],
    recent_decisions: [],
    next_steps: [],
    open_questions: [],
    key_data_points: [],
    ai_summary: 'mock AI summary',
  }),
}))
vi.mock('./project-status-generator', () => ({
  generateProjectStatusFromData: vi.fn().mockReturnValue({
    hot_topics: [],
    action_items: [],
    recent_decisions: [],
    next_steps: [],
    open_questions: [],
    key_data_points: [],
    ai_summary: 'mock summary',
  }),
}))
vi.mock('./budget-service', () => ({
  getBudgetItems: vi.fn().mockResolvedValue([]),
}))
vi.mock('./bids-service', () => ({
  getBids: vi.fn().mockResolvedValue([]),
}))
vi.mock('./selections-service', () => ({
  getSelections: vi.fn().mockResolvedValue([]),
}))
vi.mock('./loan-service', () => ({
  getConstructionLoan: vi.fn().mockResolvedValue(null),
}))
vi.mock('./notification-service', () => ({
  createActionItemNotification: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./knowledge-graph', () => ({
  getKnowledgeStateSummary: vi.fn().mockResolvedValue(null),
}))
vi.mock('./change-order-service', () => ({
  getChangeOrders: vi.fn().mockResolvedValue([]),
}))
vi.mock('./draw-schedule-service', () => ({
  getDrawSummary: vi.fn().mockResolvedValue(null),
}))
vi.mock('./warranty-service', () => ({
  getExpiringWarranties: vi.fn().mockResolvedValue([]),
  getComplianceGaps: vi.fn().mockResolvedValue(null),
}))
vi.mock('./punch-list-service', () => ({
  getPunchListStats: vi.fn().mockResolvedValue(null),
}))

import {
  calculateCurrentStep,
  getProject,
  getFullProjectContext,
  getProjectDashboard,
  getProjectStatus,
  updateProjectStatus,
  getActiveHotTopics,
  getRecentCommunications,
  getBudgetSummary,
} from './project-service'
import { db } from './database'
import { generateProjectStatusFromData } from './project-status-generator'
import { generateProjectStatusSnapshot } from './ai-summarization'
import { getBudgetItems } from './budget-service'
import { getBids } from './bids-service'
import { getSelections } from './selections-service'
import { createActionItemNotification } from './notification-service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Reset all chain methods and the shared mockResult before every test. */
function resetChain() {
  for (const m of CHAIN_METHODS) {
    mockChain[m] = vi.fn().mockReturnValue(mockChain)
  }
  mockChain.single = vi.fn().mockImplementation(() => Promise.resolve(mockResult.current))
  Object.defineProperty(mockChain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve(mockResult.current),
    writable: true,
    configurable: true,
  })
  mockResult.current = { data: null, error: null, count: null }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  resetChain()
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// calculateCurrentStep (existing tests)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('calculateCurrentStep', () => {
  it('returns {currentStep: 1, totalSteps: 6} for null input', () => {
    expect(calculateCurrentStep(null)).toEqual({ currentStep: 1, totalSteps: 6 })
  })

  it('returns {currentStep: 1, totalSteps: 6} for empty array', () => {
    expect(calculateCurrentStep([])).toEqual({ currentStep: 1, totalSteps: 6 })
  })

  it('returns the in_progress step number', () => {
    const steps = [
      { step_number: 1, status: 'completed' },
      { step_number: 2, status: 'in_progress' },
      { step_number: 3, status: 'pending' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 2, totalSteps: 3 })
  })

  it('returns highest completed + 1 when no in_progress', () => {
    const steps = [
      { step_number: 1, status: 'completed' },
      { step_number: 2, status: 'completed' },
      { step_number: 3, status: 'pending' },
      { step_number: 4, status: 'pending' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 3, totalSteps: 4 })
  })

  it('caps at totalSteps when all steps are completed', () => {
    const steps = [
      { step_number: 1, status: 'completed' },
      { step_number: 2, status: 'completed' },
      { step_number: 3, status: 'completed' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 3, totalSteps: 3 })
  })

  it('picks the highest in_progress step when multiple exist', () => {
    const steps = [
      { step_number: 1, status: 'in_progress' },
      { step_number: 2, status: 'in_progress' },
      { step_number: 3, status: 'pending' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 2, totalSteps: 3 })
  })

  it('returns 1 when all steps are pending', () => {
    const steps = [
      { step_number: 1, status: 'pending' },
      { step_number: 2, status: 'pending' },
      { step_number: 3, status: 'pending' },
      { step_number: 4, status: 'pending' },
      { step_number: 5, status: 'pending' },
      { step_number: 6, status: 'pending' },
    ]
    expect(calculateCurrentStep(steps)).toEqual({ currentStep: 1, totalSteps: 6 })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getProject
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getProject', () => {
  it('returns project data on success', async () => {
    const project = { id: 'proj-1', name: 'My House', created_at: '2025-01-01T00:00:00Z' }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    const result = await getProject()
    expect(result).toEqual(project)
    expect(mockChain.from).toHaveBeenCalledWith('projects')
  })

  it('returns null on PGRST116 (no rows) without logging an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

    const result = await getProject()
    expect(result).toBeNull()
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('returns null silently on non-PGRST116 error (no console.error)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dbError = { code: 'INTERNAL', message: 'connection failed' }
    mockChain.single.mockResolvedValueOnce({ data: null, error: dbError })

    const result = await getProject()
    expect(result).toBeNull()
    // Should NOT log — callers handle null gracefully
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getProjectDashboard
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getProjectDashboard', () => {
  it('returns default dashboard when no project exists', async () => {
    // getProject will call .single() which resolves to null data
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

    const result = await getProjectDashboard()
    expect(result).toEqual({
      phase: 'Planning',
      currentStep: 1,
      totalSteps: 6,
      daysElapsed: 0,
      totalDays: 117,
      budgetUsed: 0,
      budgetTotal: 450000,
      unreadEmails: 0,
      pendingTasks: 0,
      upcomingMilestone: '',
      milestoneDate: '',
      planningSteps: [],
    })
  })

  it('returns populated dashboard when project exists', async () => {
    const project = {
      id: 'proj-1',
      phase: 'Construction',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      estimated_duration_days: 200,
      budget_total: '500000',
    }

    // First .single() call is for getProject
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    // After getProject succeeds, getProjectDashboard does Promise.all with 5 queries.
    // All 5 are thenable (not .single()), so we need to set up the thenable to be
    // called multiple times. We use a call counter to return different results.
    let thenCallCount = 0
    const thenResults = [
      // planningSteps
      { data: [{ step_number: 1, step_name: 'Consultation', status: 'completed' }, { step_number: 2, step_name: 'Lot Analysis', status: 'in_progress' }], error: null },
      // budgetItems
      { data: [{ estimated_cost: '100000', actual_cost: '95000' }, { estimated_cost: '50000', actual_cost: '48000' }], error: null },
      // unreadEmails (count query)
      { data: null, error: null, count: 3 },
      // pendingTasks (count query)
      { data: null, error: null, count: 7 },
      // nextMilestone
      { data: [{ name: 'Foundation', target_date: '2026-03-15' }], error: null },
    ]

    Object.defineProperty(mockChain, 'then', {
      get() {
        return (resolve: (v: unknown) => void) => {
          const idx = thenCallCount++
          resolve(thenResults[idx] ?? { data: null, error: null })
        }
      },
      configurable: true,
    })

    const result = await getProjectDashboard()

    expect(result.phase).toBe('Construction')
    expect(result.currentStep).toBe(2)
    expect(result.totalSteps).toBe(2)
    expect(result.budgetUsed).toBe(143000) // 95000 + 48000
    expect(result.budgetTotal).toBe(500000)
    expect(result.unreadEmails).toBe(3)
    expect(result.pendingTasks).toBe(7)
    expect(result.upcomingMilestone).toBe('Foundation')
    expect(result.milestoneDate).toBe('2026-03-15')
    expect(result.totalDays).toBe(200)
    expect(result.daysElapsed).toBeGreaterThanOrEqual(9) // ~10 days, give tolerance
    expect(result.planningSteps).toEqual([
      { step_number: 1, name: 'Consultation', status: 'completed' },
      { step_number: 2, name: 'Lot Analysis', status: 'in_progress' },
    ])
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getProjectStatus
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getProjectStatus', () => {
  it('returns null when no project exists', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

    const result = await getProjectStatus()
    expect(result).toBeNull()
  })

  it('returns status data when project exists', async () => {
    const project = {
      id: 'proj-1',
      phase: 'Planning',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      estimated_duration_days: 117,
      budget_total: '450000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    // Promise.all with 6 thenable queries
    let thenCallCount = 0
    const thenResults = [
      // statusRecord
      {
        data: [{
          hot_topics: [{ priority: 'high', text: 'Permit delay' }],
          recent_decisions: [{ decision: 'Go with vendor A', impact: 'saves $5k' }],
          ai_summary: 'All going well.',
        }],
        error: null,
      },
      // tasks
      { data: [{ title: 'Review plans', status: 'in_progress' }, { title: 'Submit permit', status: 'pending' }], error: null },
      // emails
      { data: [{ sender_name: 'Bob', ai_summary: 'About the foundation' }], error: null },
      // budgetItems
      { data: [{ estimated_cost: '200000', actual_cost: '180000' }], error: null },
      // planningSteps
      { data: [{ step_number: 1, step_name: 'Consultation', status: 'completed' }, { step_number: 2, step_name: 'Lot Analysis', status: 'in_progress' }], error: null },
      // nextMilestone
      { data: [{ name: 'Plans Approved', target_date: '2026-04-01' }], error: null },
    ]

    Object.defineProperty(mockChain, 'then', {
      get() {
        return (resolve: (v: unknown) => void) => {
          const idx = thenCallCount++
          resolve(thenResults[idx] ?? { data: null, error: null })
        }
      },
      configurable: true,
    })

    const result = await getProjectStatus()

    expect(result).not.toBeNull()
    expect(result!.phase).toBe('Planning')
    expect(result!.currentStep).toBe('Lot Analysis')
    expect(result!.stepNumber).toBe(2)
    expect(result!.totalSteps).toBe(2)
    expect(result!.progressPercentage).toBe(100) // 2/2 = 100
    expect(result!.budgetUsed).toBe(180000)
    expect(result!.budgetTotal).toBe(450000)
    expect(result!.budgetStatus).toBe('On Track')
    expect(result!.nextMilestone).toBe('Plans Approved')
    expect(result!.milestoneDate).toBe('2026-04-01')
    expect(result!.hotTopics).toEqual([{ priority: 'high', text: 'Permit delay' }])
    expect(result!.actionItems).toEqual([
      { status: 'in-progress', text: 'Review plans' },
      { status: 'pending', text: 'Submit permit' },
    ])
    expect(result!.recentCommunications).toEqual([
      { from: 'Bob', summary: 'About the foundation' },
    ])
    expect(result!.recentDecisions).toEqual([{ decision: 'Go with vendor A', impact: 'saves $5k' }])
    expect(result!.aiSummary).toBe('All going well.')
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getActiveHotTopics
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getActiveHotTopics', () => {
  it('returns empty array when no data', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getActiveHotTopics('proj-1')
    expect(result).toEqual([])
  })

  it('returns empty array when data is empty array', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      writable: true, configurable: true,
    })

    const result = await getActiveHotTopics('proj-1')
    expect(result).toEqual([])
  })

  it('returns topic texts from object-style topics', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ hot_topics: [{ text: 'Permit delay' }, { text: 'Budget overrun' }] }],
        error: null,
      }),
      writable: true, configurable: true,
    })

    const result = await getActiveHotTopics('proj-1')
    expect(result).toEqual(['Permit delay', 'Budget overrun'])
    expect(mockChain.from).toHaveBeenCalledWith('project_status')
  })

  it('handles string-type topics', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ hot_topics: ['Roof issue', 'Plumbing concern'] }],
        error: null,
      }),
      writable: true, configurable: true,
    })

    const result = await getActiveHotTopics('proj-1')
    expect(result).toEqual(['Roof issue', 'Plumbing concern'])
  })

  it('filters out empty strings from topics', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ hot_topics: [{ text: '' }, { text: 'Valid topic' }, ''] }],
        error: null,
      }),
      writable: true, configurable: true,
    })

    const result = await getActiveHotTopics('proj-1')
    expect(result).toEqual(['Valid topic'])
  })

  it('returns empty array when hot_topics is not an array', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({
        data: [{ hot_topics: 'some legacy string' }],
        error: null,
      }),
      writable: true, configurable: true,
    })

    const result = await getActiveHotTopics('proj-1')
    expect(result).toEqual([])
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getRecentCommunications
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getRecentCommunications', () => {
  it('returns emails when data exists', async () => {
    const emails = [
      { sender_name: 'Bob', sender_email: 'bob@test.com', subject: 'Bid update', ai_summary: 'New bid', received_date: '2026-02-20' },
      { sender_name: 'Alice', sender_email: 'alice@test.com', subject: 'Plans', ai_summary: 'Revised plans', received_date: '2026-02-19' },
    ]
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: emails, error: null }),
      writable: true, configurable: true,
    })

    const result = await getRecentCommunications('proj-1')
    expect(result).toEqual(emails)
    expect(result).toHaveLength(2)
    expect(mockChain.from).toHaveBeenCalledWith('emails')
  })

  it('returns empty array when no data', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getRecentCommunications('proj-1')
    expect(result).toEqual([])
  })

  it('passes custom limit to the query', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      writable: true, configurable: true,
    })

    await getRecentCommunications('proj-1', 20)
    expect(mockChain.limit).toHaveBeenCalledWith(20)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getBudgetSummary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getBudgetSummary', () => {
  it('returns computed totals when budget items exist', async () => {
    const items = [
      { category: 'Foundation', estimated_cost: '100000', actual_cost: '95000', status: 'completed' },
      { category: 'Framing', estimated_cost: '80000', actual_cost: '82000', status: 'in_progress' },
      { category: 'Roofing', estimated_cost: '40000', actual_cost: '0', status: 'pending' },
    ]
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: items, error: null }),
      writable: true, configurable: true,
    })

    const result = await getBudgetSummary('proj-1')
    expect(result.total).toBe(220000) // 100k + 80k + 40k
    expect(result.spent).toBe(177000) // 95k + 82k + 0
    expect(result.categories).toEqual(items)
    expect(mockChain.from).toHaveBeenCalledWith('budget_items')
  })

  it('returns zeros when no data', async () => {
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getBudgetSummary('proj-1')
    expect(result).toEqual({ total: 0, spent: 0, categories: [] })
  })

  it('handles items with null actual_cost gracefully', async () => {
    const items = [
      { category: 'Electrical', estimated_cost: '60000', actual_cost: null, status: 'pending' },
    ]
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: items, error: null }),
      writable: true, configurable: true,
    })

    const result = await getBudgetSummary('proj-1')
    expect(result.total).toBe(60000)
    expect(result.spent).toBe(0)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getFullProjectContext
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getFullProjectContext', () => {
  it('returns null when project not found', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

    const result = await getFullProjectContext('bad-id')
    expect(result).toBeNull()
  })

  it('returns full context with all tables queried in parallel', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      address: '123 Main St',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      target_completion_date: '2026-12-01',
      square_footage: '5000',
      style: 'Modern',
      budget_total: '800000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    // Mock the service functions
    const mockBudgetItems = [
      { id: 'b1', category: 'Foundation', estimated_cost: 100000, actual_cost: 95000 },
    ]
    const mockBids = [
      { id: 'bid1', vendor_name: 'Acme', category: 'Foundation', total_amount: 90000 },
    ]
    const mockSelections = [
      { id: 'sel1', product_name: 'Granite Counter', category: 'countertops' },
    ]
    vi.mocked(getBudgetItems).mockResolvedValueOnce(mockBudgetItems as any)
    vi.mocked(getBids).mockResolvedValueOnce(mockBids as any)
    vi.mocked(getSelections).mockResolvedValueOnce(mockSelections as any)

    // The Promise.all has 7 supabase queries (planning, milestones, tasks, permits, contacts, vendors, communications)
    let thenCallCount = 0
    const thenResults = [
      // planningSteps
      { data: [{ step_number: 1, step_name: 'Consultation', status: 'completed', notes: 'Done' }], error: null },
      // milestones
      { data: [{ name: 'Foundation', description: 'Pour slab', target_date: '2026-03-01', completed_date: null, status: 'pending', notes: null }], error: null },
      // tasks
      { data: [{ title: 'Review plans', description: 'Check specs', due_date: '2026-03-15', priority: 'high', status: 'pending', notes: null }], error: null },
      // permits
      { data: [{ type: 'Building', permit_number: 'P001', status: 'approved', application_date: '2025-12-15', approval_date: '2026-01-15', notes: null }], error: null },
      // contacts
      { data: [{ name: 'John Smith', company: 'Acme Inc', role: 'PM', type: 'contractor' }], error: null },
      // vendors
      { data: [{ company_name: 'Acme Inc', category: 'Foundation', status: 'active' }], error: null },
      // communications
      { data: [{ date: '2026-02-28', type: 'email', subject: 'Update', summary: 'Progress report' }], error: null },
    ]

    Object.defineProperty(mockChain, 'then', {
      get() {
        return (resolve: (v: unknown) => void) => {
          const idx = thenCallCount++
          resolve(thenResults[idx] ?? { data: null, error: null })
        }
      },
      configurable: true,
    })

    const result = await getFullProjectContext('proj-1')

    expect(result).not.toBeNull()
    expect(result!.project.name).toBe('Test House')
    expect(result!.project.address).toBe('123 Main St')
    expect(result!.project.phase).toBe('Planning')
    expect(result!.project.squareFootage).toBe(5000)
    expect(result!.project.style).toBe('Modern')
    expect(result!.project.currentStep).toBe(1) // min(highest_completed+1, totalSteps) = min(2,1) = 1
    expect(result!.project.totalSteps).toBe(1)

    expect(result!.budget.total).toBe(800000)
    expect(result!.budget.spent).toBe(95000)
    expect(result!.budget.remaining).toBe(705000)
    expect(result!.budget.items).toEqual(mockBudgetItems)

    expect(result!.bids).toEqual(mockBids)
    expect(result!.selections).toEqual(mockSelections)

    expect(result!.planningSteps).toHaveLength(1)
    expect(result!.milestones).toHaveLength(1)
    expect(result!.tasks).toHaveLength(1)
    expect(result!.permits).toHaveLength(1)
    expect(result!.contacts).toHaveLength(1)
    expect(result!.vendors).toHaveLength(1)
    expect(result!.communications).toHaveLength(1)

    // Verify service functions were called with project ID
    expect(getBudgetItems).toHaveBeenCalledWith('proj-1')
    expect(getBids).toHaveBeenCalledWith('proj-1')
    expect(getSelections).toHaveBeenCalledWith('proj-1')
  })

  it('handles null/empty query results gracefully', async () => {
    const project = {
      id: 'proj-1',
      name: 'Empty Project',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: '450000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([])
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    // All 7 supabase queries return null data
    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getFullProjectContext('proj-1')

    expect(result).not.toBeNull()
    expect(result!.planningSteps).toEqual([])
    expect(result!.milestones).toEqual([])
    expect(result!.tasks).toEqual([])
    expect(result!.permits).toEqual([])
    expect(result!.contacts).toEqual([])
    expect(result!.vendors).toEqual([])
    expect(result!.communications).toEqual([])
    expect(result!.budget.spent).toBe(0)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// updateProjectStatus
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('updateProjectStatus', () => {
  it('returns early when project not found', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

    await updateProjectStatus('bad-id')

    expect(consoleSpy).toHaveBeenCalledWith('updateProjectStatus: project not found', 'bad-id')
    expect(db.upsertProjectStatus).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('generates deterministic snapshot and writes to database', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: '450000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([])
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const mockSnapshot = {
      hot_topics: [{ priority: 'high', text: 'New bid received' }],
      action_items: [{ status: 'pending', text: 'Review bid' }],
      recent_decisions: [],
      next_steps: ['Schedule review'],
      open_questions: [],
      key_data_points: [],
      ai_summary: 'New bid from vendor.',
    }
    vi.mocked(generateProjectStatusFromData).mockReturnValueOnce(mockSnapshot)

    await updateProjectStatus('proj-1')

    // Verify generator was called with context
    expect(generateProjectStatusFromData).toHaveBeenCalledWith(
      expect.objectContaining({ project: expect.objectContaining({ name: 'Test House' }) }),
    )

    // Verify database write
    expect(db.upsertProjectStatus).toHaveBeenCalledWith('proj-1', expect.objectContaining({
      phase: 'Planning',
      hot_topics: mockSnapshot.hot_topics,
      action_items: mockSnapshot.action_items,
      ai_summary: 'New bid from vendor.',
    }))

    // Task sync removed — deterministic generator derives action items for display only
  })

  it('produces snapshot even with no emails (deterministic)', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: '450000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([])
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    await updateProjectStatus('proj-1')

    // Generator always called (deterministic — no email dependency)
    expect(generateProjectStatusFromData).toHaveBeenCalled()
    expect(db.upsertProjectStatus).toHaveBeenCalled()
  })

  it('generates from full project context (no iterative state needed)', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: '450000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([])
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    await updateProjectStatus('proj-1')

    // Deterministic generator uses only the current context, not previous status
    expect(generateProjectStatusFromData).toHaveBeenCalledWith(
      expect.objectContaining({
        project: expect.any(Object),
        budget: expect.any(Object),
        bids: expect.any(Array),
      }),
    )
  })

  it('no longer needs string normalization (deterministic from structured data)', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: '450000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([])
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    await updateProjectStatus('proj-1')

    // Generator receives structured context, not parsed legacy strings
    const call = vi.mocked(generateProjectStatusFromData).mock.calls[0]
    expect(call[0]).toHaveProperty('project')
    expect(call[0]).toHaveProperty('budget')
  })

  it('syncs AI tasks and creates notifications for draft_email items', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: '450000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([])
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    // AI snapshot will be generated from emails
    vi.mocked(db.getRecentEmails).mockResolvedValueOnce([
      { message_id: 'm1', subject: 'Test', sender_email: 'v@test.com', body_text: 'Hi', received_date: '2026-02-28' } as any,
    ])
    vi.mocked(db.getLatestProjectStatus).mockResolvedValueOnce(null)

    const mockAISnapshot = {
      hot_topics: [],
      action_items: [
        { status: 'pending', text: 'Draft email to vendor', action_type: 'draft_email' as const },
        { status: 'pending', text: 'Call inspector', action_type: null },
      ],
      recent_decisions: [],
      next_steps: [],
      open_questions: [],
      key_data_points: [],
      ai_summary: 'Test summary.',
    }
    vi.mocked(generateProjectStatusSnapshot).mockResolvedValueOnce(mockAISnapshot)
    vi.mocked(generateProjectStatusFromData).mockReturnValueOnce({
      hot_topics: [], action_items: [], recent_decisions: [],
      next_steps: [], open_questions: [], key_data_points: [],
      ai_summary: 'Deterministic fallback.',
    })

    await updateProjectStatus('proj-1')

    // AI task sync restored — syncs action items from AI snapshot
    expect(db.syncAIInsightsToTasks).toHaveBeenCalledWith('proj-1', mockAISnapshot.action_items)
    // Notification for draft_email action item
    expect(createActionItemNotification).toHaveBeenCalledWith('proj-1', 'Draft email to vendor')
  })

  it('computes budget_status as Over Budget when spent exceeds total', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Construction',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: '100000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([
      { id: 'b1', category: 'Foundation', estimated_cost: 50000, actual_cost: 60000 },
      { id: 'b2', category: 'Framing', estimated_cost: 50000, actual_cost: 50000 },
    ] as any)
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    vi.mocked(db.getRecentEmails).mockResolvedValueOnce([
      { message_id: 'm1', subject: 'Test', sender_email: 'v@test.com', body_text: 'Hi', received_date: '2026-02-28' } as any,
    ])

    await updateProjectStatus('proj-1')

    expect(db.upsertProjectStatus).toHaveBeenCalledWith('proj-1', expect.objectContaining({
      budget_status: 'Over Budget',
      budget_used: 110000,
    }))
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getFullProjectContext — additional edge cases
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getFullProjectContext — edge cases', () => {
  it('parses string square_footage to number', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      square_footage: '7500',
      budget_total: '450000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([])
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getFullProjectContext('proj-1')
    expect(result!.project.squareFootage).toBe(7500)
  })

  it('defaults budget total to 450000 when not set', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: null,
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([])
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getFullProjectContext('proj-1')
    expect(result!.budget.total).toBe(450000)
  })

  it('sums actual_cost correctly across multiple budget items', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: '500000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([
      { id: 'b1', actual_cost: 25000 },
      { id: 'b2', actual_cost: 75000 },
      { id: 'b3', actual_cost: null },
      { id: 'b4', actual_cost: 0 },
    ] as any)
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getFullProjectContext('proj-1')
    expect(result!.budget.spent).toBe(100000)
    expect(result!.budget.remaining).toBe(400000)
  })

  it('sets currentStep 1 and totalSteps 6 when no planning steps', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test House',
      phase: 'Planning',
      created_at: '2025-12-01T00:00:00Z',
      budget_total: '450000',
    }
    mockChain.single.mockResolvedValueOnce({ data: project, error: null })

    vi.mocked(getBudgetItems).mockResolvedValueOnce([])
    vi.mocked(getBids).mockResolvedValueOnce([])
    vi.mocked(getSelections).mockResolvedValueOnce([])

    Object.defineProperty(mockChain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true, configurable: true,
    })

    const result = await getFullProjectContext('proj-1')
    expect(result!.project.currentStep).toBe(1)
    expect(result!.project.totalSteps).toBe(6)
  })
})
