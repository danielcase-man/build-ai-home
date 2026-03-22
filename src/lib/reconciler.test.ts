import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock audit-service
const mockLogChange = vi.fn().mockResolvedValue(undefined)
vi.mock('./audit-service', () => ({
  logChange: (...args: unknown[]) => mockLogChange(...args),
}))

// Mock supabase — we intercept at the module level and control per-test
const mockFrom = vi.fn()
vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { ProjectReconciler } from './reconciler'

// ---------------------------------------------------------------------------
// Helpers — build a mock supabase that returns specific data per table
// ---------------------------------------------------------------------------

function setupEvidence(tableData: Record<string, unknown[]>) {
  mockFrom.mockImplementation((table: string) => {
    const data = tableData[table] || []

    // Build a chainable mock that always resolves with {data, error: null}
    const chain: Record<string, unknown> = {}
    const methods = ['select', 'eq', 'order', 'limit', 'single', 'in', 'not', 'lte', 'gte']
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain)
    }

    // update() returns a sub-chain with eq that resolves
    chain['update'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    // Make the chain thenable so await resolves to data
    chain['then'] = (resolve: (v: unknown) => void) => resolve({ data, error: null })

    return chain
  })
}

describe('ProjectReconciler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('reconcileAll', () => {
    it('returns empty result when no evidence', async () => {
      setupEvidence({})
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('milestone reconciliation', () => {
    it('promotes Pre-construction to in_progress when bids exist', async () => {
      setupEvidence({
        milestones: [{ id: 'ms-1', name: 'Pre-construction', status: 'pending', notes: null }],
        bids: [{ id: 'b-1', vendor_name: 'Triple C', category: 'Site Work', status: 'pending' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].new_value).toBe('in_progress')
    })

    it('promotes Design Finalization to completed when architect done + plans exist', async () => {
      setupEvidence({
        milestones: [{ id: 'ms-2', name: 'Design Finalization', status: 'pending', notes: null }],
        vendors: [{ id: 'v-1', company_name: 'Kipp Flores', category: 'architecture', status: 'completed', notes: null }],
        documents: [{ id: 'd-1', name: 'Floor Plans', category: 'architectural_plans' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].new_value).toBe('completed')
      expect(result.changes[0].reason).toContain('Architect completed')
    })

    it('does NOT demote a completed milestone', async () => {
      setupEvidence({
        milestones: [{ id: 'ms-1', name: 'Pre-construction', status: 'completed', notes: null }],
        bids: [],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(0)
    })

    it('skips locked milestones', async () => {
      setupEvidence({
        milestones: [{ id: 'ms-1', name: 'Pre-construction', status: 'pending', notes: '[locked] Manual override' }],
        bids: [{ id: 'b-1', vendor_name: 'Test', category: 'Site Work', status: 'selected' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(0)
      expect(result.skipped).toBeGreaterThan(0)
    })

    it('promotes Procurement to in_progress when bids under review', async () => {
      setupEvidence({
        milestones: [{ id: 'ms-4', name: 'Procurement', status: 'pending', notes: null }],
        bids: [
          { id: 'b-1', vendor_name: 'V1', category: 'Windows', status: 'under_review' },
          { id: 'b-2', vendor_name: 'V2', category: 'Flooring', status: 'selected' },
        ],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].new_value).toBe('in_progress')
    })

    it('promotes Interior Finishes when flooring bid selected', async () => {
      setupEvidence({
        milestones: [{ id: 'ms-int', name: 'Interior Finishes', status: 'pending', notes: null }],
        bids: [{ id: 'b-1', vendor_name: 'Kristynik', category: 'Flooring', status: 'selected' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].reason).toContain('Flooring')
    })

    it('skips unrecognized milestone names', async () => {
      setupEvidence({
        milestones: [{ id: 'ms-x', name: 'Some Random Milestone', status: 'pending', notes: null }],
        bids: [{ id: 'b-1', vendor_name: 'V1', category: 'Everything', status: 'selected' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(0)
    })
  })

  describe('planning step reconciliation', () => {
    it('promotes step 1 to completed when UBuildIt consultant exists', async () => {
      setupEvidence({
        planning_phase_steps: [{ id: 'ps-1', step_number: 1, name: 'Consultation', status: 'not_started', notes: null }],
        contacts: [{ id: 'c-1', name: 'Aaron', company: 'UBuildIt - Williamson', role: 'Consultant' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].new_value).toBe('completed')
    })

    it('promotes step 4 to in_progress when bids exist', async () => {
      setupEvidence({
        planning_phase_steps: [{ id: 'ps-4', step_number: 4, name: 'Estimating', status: 'not_started', notes: null }],
        bids: [{ id: 'b-1', vendor_name: 'V1', category: 'Windows', status: 'pending' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].new_value).toBe('in_progress')
    })

    it('promotes step 5 to in_progress when loan in progress', async () => {
      setupEvidence({
        planning_phase_steps: [{ id: 'ps-5', step_number: 5, name: 'Financing', status: 'not_started', notes: null }],
        construction_loans: [{ application_status: 'submitted' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].new_value).toBe('in_progress')
    })

    it('never auto-completes step 6', async () => {
      setupEvidence({
        planning_phase_steps: [{ id: 'ps-6', step_number: 6, name: 'Pre-construction Meeting', status: 'not_started', notes: null }],
        construction_loans: [{ application_status: 'funded' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(0)
    })

    it('does not demote completed steps', async () => {
      setupEvidence({
        planning_phase_steps: [{ id: 'ps-1', step_number: 1, name: 'Consultation', status: 'completed', notes: null }],
        contacts: [],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(0)
    })
  })

  describe('vendor status reconciliation', () => {
    it('promotes vendor from potential to active when bid selected', async () => {
      setupEvidence({
        vendors: [{ id: 'v-1', company_name: 'Kristynik', category: 'flooring', status: 'potential', notes: null }],
        bids: [{ id: 'b-1', vendor_name: 'Kristynik', category: 'Flooring', status: 'selected' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].new_value).toBe('active')
    })

    it('does not promote when bids only pending', async () => {
      setupEvidence({
        vendors: [{ id: 'v-1', company_name: 'SomeVendor', category: 'roofing', status: 'potential', notes: null }],
        bids: [{ id: 'b-1', vendor_name: 'SomeVendor', category: 'Roofing', status: 'pending' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(0)
    })

    it('skips vendor already at active', async () => {
      setupEvidence({
        vendors: [{ id: 'v-1', company_name: 'Kristynik', category: 'flooring', status: 'active', notes: null }],
        bids: [{ id: 'b-1', vendor_name: 'Kristynik', category: 'Flooring', status: 'selected' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(0)
    })

    it('skips locked vendors', async () => {
      setupEvidence({
        vendors: [{ id: 'v-1', company_name: 'LockedV', category: 'roofing', status: 'potential', notes: '[locked]' }],
        bids: [{ id: 'b-1', vendor_name: 'LockedV', category: 'Roofing', status: 'selected' }],
      })
      const r = new ProjectReconciler('proj-1')
      const result = await r.reconcileAll()
      expect(result.changes).toHaveLength(0)
    })
  })

  describe('audit logging', () => {
    it('calls logChange for every update with actor=reconciler', async () => {
      setupEvidence({
        planning_phase_steps: [{ id: 'ps-1', step_number: 1, name: 'Consultation', status: 'not_started', notes: null }],
        contacts: [{ id: 'c-1', name: 'Aaron', company: 'UBuildIt', role: 'Consultant' }],
      })
      const r = new ProjectReconciler('proj-1')
      await r.reconcileAll()
      expect(mockLogChange).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          entityType: 'planning_step',
          actor: 'reconciler',
          newValue: 'completed',
        })
      )
    })
  })
})
