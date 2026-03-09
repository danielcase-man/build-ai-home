import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Supabase chainable mock ────────────────────────────────────────

const { mockChain, CHAIN_METHODS } = vi.hoisted(() => {
  const chain: Record<string, any> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'gte', 'order', 'limit', 'single', 'from'] as const
  return { mockChain: chain, CHAIN_METHODS: methods }
})

vi.mock('./supabase', () => {
  for (const m of CHAIN_METHODS) {
    mockChain[m] = vi.fn().mockReturnValue(mockChain)
  }
  mockChain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  Object.defineProperty(mockChain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null, status: 201 }),
    writable: true,
    configurable: true,
  })
  return { supabase: { from: (...args: unknown[]) => mockChain.from(...args) } }
})

// ─── Mock JobTread service ──────────────────────────────────────────

const mockJTService = {
  getCostItems: vi.fn(),
  getTasks: vi.fn(),
  getDailyLogs: vi.fn(),
  getComments: vi.fn(),
  getFiles: vi.fn(),
}

vi.mock('./jobtread', () => ({
  getJobTreadService: () => mockJTService,
  JobTreadService: vi.fn(),
}))

import { JobTreadSyncService } from './jobtread-sync'

function resetChain() {
  for (const m of CHAIN_METHODS) {
    mockChain[m] = vi.fn().mockReturnValue(mockChain)
  }
  mockChain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  Object.defineProperty(mockChain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null, status: 201 }),
    writable: true,
    configurable: true,
  })
}

describe('JobTreadSyncService', () => {
  let svc: JobTreadSyncService

  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
    svc = new JobTreadSyncService('project-123')
  })

  describe('syncCostItems', () => {
    it('maps cost items and upserts to budget_items', async () => {
      mockJTService.getCostItems.mockResolvedValue([
        {
          id: 'ci-1',
          name: 'Flooring',
          description: 'Hardwood floors',
          quantity: 1,
          unitCost: 50000,
          unitPrice: 60000,
          cost: 77014,
          price: 80000,
          costCode: { name: 'Flooring', number: '09-001' },
        },
      ])

      const result = await svc.syncCostItems()

      expect(mockJTService.getCostItems).toHaveBeenCalled()
      expect(mockChain.from).toHaveBeenCalledWith('budget_items')
      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'project-123',
          jobtread_id: 'ci-1',
          category: 'Flooring',
          subcategory: '09-001',
          estimated_cost: 770.14, // cents to dollars
          source: 'jobtread',
        }),
        { onConflict: 'jobtread_id' },
      )
      expect(result.entity).toBe('cost_items')
      expect(result.errors).toHaveLength(0)
    })

    it('handles missing cost code gracefully', async () => {
      mockJTService.getCostItems.mockResolvedValue([
        {
          id: 'ci-2',
          name: 'Misc Item',
          description: null,
          quantity: null,
          unitCost: null,
          unitPrice: null,
          cost: 10000,
          price: 12000,
          costCode: null,
        },
      ])

      await svc.syncCostItems()

      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Uncategorized',
          subcategory: null,
          estimated_cost: 100,
        }),
        { onConflict: 'jobtread_id' },
      )
    })

    it('records errors from failed upserts', async () => {
      mockJTService.getCostItems.mockResolvedValue([
        { id: 'ci-3', name: 'Bad Item', cost: 100, price: 200, description: null, quantity: null, unitCost: null, unitPrice: null, costCode: null },
      ])

      Object.defineProperty(mockChain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'DB constraint violation' }, status: 400 }),
        writable: true,
        configurable: true,
      })

      const result = await svc.syncCostItems()
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Bad Item')
    })

    it('handles fetch failures', async () => {
      mockJTService.getCostItems.mockRejectedValue(new Error('Network timeout'))

      const result = await svc.syncCostItems()
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Fetch failed')
      expect(result.errors[0]).toContain('Network timeout')
    })
  })

  describe('syncTasks', () => {
    it('maps completed tasks correctly', async () => {
      mockJTService.getTasks.mockResolvedValue([
        {
          id: 'task-1',
          name: 'Pour Foundation',
          description: 'Foundation work',
          progress: 100,
          startDate: '2026-01-15',
          endDate: '2026-02-01',
          completed: 1,
          taskType: { name: 'Construction' },
          createdAt: '2026-01-10T00:00:00Z',
        },
      ])

      const result = await svc.syncTasks()

      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          jobtread_id: 'task-1',
          title: 'Pour Foundation',
          status: 'completed',
          due_date: '2026-02-01',
        }),
        { onConflict: 'jobtread_id' },
      )
      expect(result.entity).toBe('tasks')
    })

    it('maps in-progress tasks (progress > 0, not completed)', async () => {
      mockJTService.getTasks.mockResolvedValue([
        {
          id: 'task-2', name: 'Framing', description: null,
          progress: 50, startDate: null, endDate: null,
          completed: 0, taskType: null, createdAt: '2026-02-01T00:00:00Z',
        },
      ])

      await svc.syncTasks()

      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'in_progress' }),
        { onConflict: 'jobtread_id' },
      )
    })

    it('maps pending tasks (progress 0, not completed)', async () => {
      mockJTService.getTasks.mockResolvedValue([
        {
          id: 'task-3', name: 'Drywall', description: null,
          progress: 0, startDate: null, endDate: null,
          completed: 0, taskType: null, createdAt: '2026-02-15T00:00:00Z',
        },
      ])

      await svc.syncTasks()

      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
        { onConflict: 'jobtread_id' },
      )
    })
  })

  describe('syncDailyLogs', () => {
    it('maps daily logs to communications table', async () => {
      mockJTService.getDailyLogs.mockResolvedValue([
        { id: 'dl-1', date: '2026-02-20', notes: 'Foundation inspection passed', createdAt: '2026-02-20T10:00:00Z' },
      ])

      const result = await svc.syncDailyLogs()

      expect(mockChain.from).toHaveBeenCalledWith('communications')
      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          jobtread_id: 'dl-1',
          type: 'daily_log',
          summary: 'Foundation inspection passed',
          subject: 'Daily Log — 2026-02-20',
        }),
        { onConflict: 'jobtread_id' },
      )
      expect(result.entity).toBe('daily_logs')
    })
  })

  describe('syncComments', () => {
    it('maps comments to communications table', async () => {
      mockJTService.getComments.mockResolvedValue([
        { id: 'cmt-1', message: 'Permits approved!', createdAt: '2026-03-01T14:30:00Z' },
      ])

      const result = await svc.syncComments()

      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          jobtread_id: 'cmt-1',
          type: 'jobtread_comment',
          summary: 'Permits approved!',
          subject: 'JobTread Comment — 2026-03-01',
        }),
        { onConflict: 'jobtread_id' },
      )
      expect(result.entity).toBe('comments')
    })
  })

  describe('syncFiles', () => {
    it('maps files to documents table', async () => {
      mockJTService.getFiles.mockResolvedValue([
        { id: 'f-1', name: 'site-photo.jpg', url: 'https://cdn.jobtread.com/file/123', size: 2048, folder: 'Photos', createdAt: '2026-02-25T09:00:00Z' },
      ])

      const result = await svc.syncFiles()

      expect(mockChain.from).toHaveBeenCalledWith('documents')
      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          jobtread_id: 'f-1',
          name: 'site-photo.jpg',
          file_url: 'https://cdn.jobtread.com/file/123',
          file_size: 2048,
          category: 'Photos',
          upload_date: '2026-02-25T09:00:00Z',
        }),
        { onConflict: 'jobtread_id' },
      )
      expect(result.entity).toBe('files')
    })

    it('defaults folder to "JobTread" when null', async () => {
      mockJTService.getFiles.mockResolvedValue([
        { id: 'f-2', name: 'plan.pdf', url: 'https://cdn.jobtread.com/file/456', size: null, folder: null, createdAt: '2026-02-26T00:00:00Z' },
      ])

      await svc.syncFiles()

      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'JobTread' }),
        { onConflict: 'jobtread_id' },
      )
    })
  })

  describe('syncAll', () => {
    it('runs all sync methods and aggregates results', async () => {
      // Return empty arrays for all
      mockJTService.getCostItems.mockResolvedValue([])
      mockJTService.getTasks.mockResolvedValue([])
      mockJTService.getDailyLogs.mockResolvedValue([])
      mockJTService.getComments.mockResolvedValue([])
      mockJTService.getFiles.mockResolvedValue([])

      const result = await svc.syncAll()

      expect(result.results).toHaveLength(5)
      expect(result.results.map((r: { entity: string }) => r.entity)).toEqual([
        'cost_items', 'tasks', 'daily_logs', 'comments', 'files',
      ])
      expect(result.totalCreated).toBe(0)
      expect(result.totalUpdated).toBe(0)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('updates sync state after each entity sync', async () => {
      mockJTService.getCostItems.mockResolvedValue([
        { id: 'ci-1', name: 'Item', cost: 100, price: 200, description: null, quantity: null, unitCost: null, unitPrice: null, costCode: null },
      ])
      mockJTService.getTasks.mockResolvedValue([])
      mockJTService.getDailyLogs.mockResolvedValue([])
      mockJTService.getComments.mockResolvedValue([])
      mockJTService.getFiles.mockResolvedValue([])

      await svc.syncAll()

      // Should have been called with jobtread_sync_state for each entity type
      const syncStateCalls = mockChain.from.mock.calls.filter(
        (call: string[]) => call[0] === 'jobtread_sync_state'
      )
      expect(syncStateCalls.length).toBe(5)
    })
  })

  describe('constructor', () => {
    it('accepts explicit jtService parameter', () => {
      // Constructor with explicit service should not throw
      const explicitSvc = new JobTreadSyncService('proj-1', mockJTService as any)
      expect(explicitSvc).toBeInstanceOf(JobTreadSyncService)
    })
  })
})
