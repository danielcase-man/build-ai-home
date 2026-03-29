import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase, makeProject } from '@/test/helpers'

// Mock supabase (create inline to avoid hoisting issues)
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

// Mock project-service
vi.mock('./project-service', () => ({
  getProject: vi.fn().mockResolvedValue(makeProject()),
  getFullProjectContext: vi.fn().mockResolvedValue(null),
}))

// Mock source-watermarks
const mockGetAllWatermarks = vi.fn().mockResolvedValue([])
const mockShouldProcess = vi.fn().mockReturnValue(true)
const mockUpdateWatermark = vi.fn().mockResolvedValue(undefined)
vi.mock('./source-watermarks', () => ({
  getAllWatermarks: () => mockGetAllWatermarks(),
  shouldProcess: (...args: unknown[]) => mockShouldProcess(...args),
  updateWatermark: (...args: unknown[]) => mockUpdateWatermark(...args),
}))

// Mock dropbox-watcher
const mockScanDropbox = vi.fn().mockResolvedValue({
  newFiles: [],
  modifiedFiles: [],
  totalScanned: 0,
  errors: [],
})
const mockGetPendingFiles = vi.fn().mockResolvedValue([])
vi.mock('./dropbox-watcher', () => ({
  scanDropboxIncremental: (...args: unknown[]) => mockScanDropbox(...args),
  getPendingFiles: (...args: unknown[]) => mockGetPendingFiles(...args),
  getInventoryStats: vi.fn().mockResolvedValue({ total: 0, pending: 0 }),
}))

// Mock agent-router
const mockDispatch = vi.fn().mockResolvedValue([])
vi.mock('./agent-router', () => ({
  dispatchToAgents: (...args: unknown[]) => mockDispatch(...args),
  classifyEmail: vi.fn().mockReturnValue('general'),
  registerAgent: vi.fn(),
  getRegisteredDomains: vi.fn().mockReturnValue(['bid_analysis', 'takeoff', 'financial', 'contract']),
}))

// Mock all agents (just need to not error on import)
vi.mock('./bid-analysis-agent', () => ({}))
vi.mock('./takeoff-agent', () => ({}))
vi.mock('./financial-agent', () => ({}))
vi.mock('./contract-agent', () => ({}))
vi.mock('./scheduling-agent', () => ({}))
vi.mock('./follow-up-agent', () => ({}))

// Mock project-status-generator
vi.mock('./project-status-generator', () => ({
  generateProjectStatusFromData: vi.fn().mockReturnValue({
    hot_topics: [], action_items: [], recent_decisions: [],
    next_steps: [], open_questions: [], key_data_points: [],
    ai_summary: 'Test summary',
  }),
}))

// Mock database
vi.mock('./database', () => ({
  db: { upsertProjectStatus: vi.fn().mockResolvedValue(undefined) },
}))

import { runIntelligenceEngine, getLatestRun } from './intelligence-engine'

describe('intelligence-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: intelligence_runs insert succeeds
    chain.single.mockResolvedValue({ data: { id: 'run-001' }, error: null })

    // Default: the thenable chain resolves with no data
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      writable: true,
      configurable: true,
    })
  })

  it('creates a run record and returns result', async () => {
    const result = await runIntelligenceEngine({ sources: ['dropbox'] })

    expect(result.run_id).toBe('run-001')
    expect(result.sources_checked).toContain('dropbox')
    expect(result.started_at).toBeDefined()
    expect(result.completed_at).toBeDefined()
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('scans Dropbox when source is included', async () => {
    mockScanDropbox.mockResolvedValueOnce({
      newFiles: [{ source: 'dropbox', domain: 'bid_analysis', file_path: '/test.pdf', detected_at: '2026-03-29' }],
      modifiedFiles: [],
      totalScanned: 100,
      errors: [],
    })

    const result = await runIntelligenceEngine({ sources: ['dropbox'], force: true })

    expect(mockScanDropbox).toHaveBeenCalled()
    expect(result.changes_detected).toBe(1)
  })

  it('dispatches changes to agents when found', async () => {
    const changes = [
      { source: 'dropbox', domain: 'bid_analysis', file_path: '/a.pdf', detected_at: '2026-03-29' },
      { source: 'dropbox', domain: 'bid_analysis', file_path: '/b.pdf', detected_at: '2026-03-29' },
    ]
    mockScanDropbox.mockResolvedValueOnce({
      newFiles: changes,
      modifiedFiles: [],
      totalScanned: 200,
      errors: [],
    })
    mockDispatch.mockResolvedValueOnce([{
      domain: 'bid_analysis',
      source: 'dropbox',
      action: 'processed',
      details: 'Done',
      records_created: 2,
      records_updated: 0,
      errors: [],
      duration_ms: 500,
    }])

    const result = await runIntelligenceEngine({ sources: ['dropbox'], force: true })

    expect(mockDispatch).toHaveBeenCalled()
    expect(result.agents_invoked).toContain('bid_analysis')
    expect(result.results).toHaveLength(1)
  })

  it('skips sources when watermark interval not reached', async () => {
    mockShouldProcess.mockReturnValue(false)

    const result = await runIntelligenceEngine({ sources: ['dropbox'] })

    expect(mockScanDropbox).not.toHaveBeenCalled()
    expect(result.changes_detected).toBe(0)
  })

  it('processes backlog when option is set', async () => {
    // First domain (bid_analysis) returns a pending file; others return empty
    mockGetPendingFiles
      .mockResolvedValueOnce([{
        file_path: '/pending.pdf',
        file_name: 'pending.pdf',
        file_type: 'pdf',
        agent_domain: 'bid_analysis',
      }])
      .mockResolvedValue([]) // remaining domains: empty

    // Override scan to return nothing new
    mockScanDropbox.mockResolvedValueOnce({
      newFiles: [],
      modifiedFiles: [],
      totalScanned: 100,
      errors: [],
    })

    const result = await runIntelligenceEngine({
      sources: ['dropbox'],
      force: true,
      processBacklog: true,
    })

    // Called once per registered domain
    expect(mockGetPendingFiles).toHaveBeenCalledTimes(4)
    expect(result.changes_detected).toBe(1)
  })

  it('handles errors gracefully', async () => {
    mockScanDropbox.mockRejectedValueOnce(new Error('Dropbox folder not found'))

    const result = await runIntelligenceEngine({ sources: ['dropbox'], force: true })

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Dropbox folder not found')
  })

  it('returns no project error when project is missing', async () => {
    const { getProject } = await import('./project-service')
    vi.mocked(getProject).mockResolvedValueOnce(null)

    const result = await runIntelligenceEngine()

    expect(result.errors).toContain('No project found')
    expect(result.changes_detected).toBe(0)
  })

  describe('getLatestRun', () => {
    it('returns the most recent run', async () => {
      chain.single.mockResolvedValueOnce({
        data: {
          id: 'run-latest',
          started_at: '2026-03-29T10:00:00Z',
          completed_at: '2026-03-29T10:01:00Z',
          sources_checked: ['dropbox'],
          changes_detected: 5,
          agents_invoked: ['bid_analysis'],
          results: [],
          errors: [],
          duration_ms: 60000,
        },
        error: null,
      })

      const run = await getLatestRun()
      expect(run).toBeDefined()
      expect(run?.run_id).toBe('run-latest')
      expect(run?.changes_detected).toBe(5)
    })

    it('returns null when no runs exist', async () => {
      chain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

      const run = await getLatestRun()
      expect(run).toBeNull()
    })
  })
})
