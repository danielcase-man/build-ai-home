import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabase } from '@/test/helpers'

// Mock supabase (create inline to avoid hoisting issues)
const mockSetup = createMockSupabase()
const chain = mockSetup.chain

vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => chain.from(...args) },
}))

import {
  parseVersion,
  classifyPlanFile,
  discoverLatestPlans,
  ALL_PLAN_TYPES,
} from './plan-discovery-service'

// ─── parseVersion ────────────────────────────────────────────────────────────

describe('parseVersion', () => {
  it('parses REV followed by a number', () => {
    const result = parseVersion('Foundation Plan REV3.pdf')
    expect(result).toEqual({ version: 3, label: 'REV3' })
  })

  it('parses REV alone (no number) as version 1', () => {
    const result = parseVersion('Foundation Plan REV.pdf')
    expect(result).toEqual({ version: 1, label: 'REV' })
  })

  it('parses lowercase rev with number', () => {
    const result = parseVersion('structural rev2.pdf')
    expect(result).toEqual({ version: 2, label: 'REV2' })
  })

  it('parses v-prefixed version number', () => {
    const result = parseVersion('Grading Plan v2.pdf')
    expect(result).toEqual({ version: 2, label: 'v2' })
  })

  it('parses uppercase V-prefixed version number', () => {
    const result = parseVersion('Site Plan V4.pdf')
    expect(result).toEqual({ version: 4, label: 'v4' })
  })

  it('parses parenthesized number as version', () => {
    const result = parseVersion('Drainage Plan (002).pdf')
    expect(result).toEqual({ version: 2, label: '(2)' })
  })

  it('parses "(version N)" format', () => {
    const result = parseVersion('Main House Plans (version 1).pdf')
    expect(result).toEqual({ version: 1, label: 'version 1' })
  })

  it('parses date pattern MM-DD-YY as date-based version', () => {
    const result = parseVersion('Foundation Plan 10-06-25.pdf')
    // 10-06-25 → MM=10, DD=06, YY=25 → 2025-10-06 → 20251006
    expect(result).toEqual({ version: 20251006, label: '10-06-25' })
  })

  it('parses date pattern MM-DD-YYYY as date-based version', () => {
    const result = parseVersion('Site Plan 03-15-2026.pdf')
    expect(result).toEqual({ version: 20260315, label: '03-15-2026' })
  })

  it('parses date pattern YY-MM-DD when first segment > 12', () => {
    const result = parseVersion('Plans 25-03-15.pdf')
    // 25 > 12, so YY-MM-DD → 2025-03-15 → 20250315
    expect(result).toEqual({ version: 20250315, label: '25-03-15' })
  })

  it('returns version 0 with label "original" when no marker found', () => {
    const result = parseVersion('Foundation Plan.pdf')
    expect(result).toEqual({ version: 0, label: 'original' })
  })

  it('prioritizes REV over date pattern', () => {
    const result = parseVersion('Foundation Plan 10-06-25 REV3.pdf')
    expect(result).toEqual({ version: 3, label: 'REV3' })
  })
})

// ─── classifyPlanFile ────────────────────────────────────────────────────────

describe('classifyPlanFile', () => {
  it('classifies foundation plans', () => {
    const result = classifyPlanFile('Foundation Plan REV3.pdf')
    expect(result).toEqual({ planType: 'foundation', confidence: 0.95 })
  })

  it('classifies footing plans as foundation', () => {
    const result = classifyPlanFile('Footing Details.pdf')
    expect(result).toEqual({ planType: 'foundation', confidence: 0.95 })
  })

  it('classifies structural plans for "main house"', () => {
    const result = classifyPlanFile('Case Residence Main House.pdf')
    expect(result).toEqual({ planType: 'structural', confidence: 0.90 })
  })

  it('classifies structural plans for "rv garage"', () => {
    const result = classifyPlanFile('RV Garage Framing.pdf')
    expect(result).toEqual({ planType: 'structural', confidence: 0.90 })
  })

  it('classifies structural plans for "rafter"', () => {
    const result = classifyPlanFile('Rafter Layout.pdf')
    expect(result).toEqual({ planType: 'structural', confidence: 0.90 })
  })

  it('classifies site/civil plans for "drainage and grading"', () => {
    const result = classifyPlanFile('Drainage and Grading Plan.pdf')
    expect(result).toEqual({ planType: 'site', confidence: 0.90 })
  })

  it('classifies site plans for "topo"', () => {
    const result = classifyPlanFile('Topographic Survey.pdf')
    expect(result).toEqual({ planType: 'site', confidence: 0.90 })
  })

  it('classifies electrical plans', () => {
    const result = classifyPlanFile('Electrical Layout.pdf')
    expect(result).toEqual({ planType: 'electrical', confidence: 0.85 })
  })

  it('classifies PEC service packet as electrical', () => {
    const result = classifyPlanFile('PEC Service Packet.pdf')
    expect(result).toEqual({ planType: 'electrical', confidence: 0.85 })
  })

  it('classifies OSSF as plumbing', () => {
    const result = classifyPlanFile('OSSF Design.pdf')
    expect(result).toEqual({ planType: 'plumbing', confidence: 0.85 })
  })

  it('classifies septic as plumbing', () => {
    const result = classifyPlanFile('Septic System Layout.pdf')
    expect(result).toEqual({ planType: 'plumbing', confidence: 0.85 })
  })

  it('classifies front elevation as architectural', () => {
    const result = classifyPlanFile('Front Elevation with callouts.pdf')
    expect(result).toEqual({ planType: 'architectural', confidence: 0.85 })
  })

  it('classifies floor plan as architectural', () => {
    const result = classifyPlanFile('First Floor Plan.pdf')
    expect(result).toEqual({ planType: 'architectural', confidence: 0.85 })
  })

  it('classifies section as architectural', () => {
    const result = classifyPlanFile('Building Section A-A.pdf')
    expect(result).toEqual({ planType: 'architectural', confidence: 0.85 })
  })

  it('classifies assembly and transition details as detail', () => {
    const result = classifyPlanFile('Assembly + Transition Details.pdf')
    expect(result).toEqual({ planType: 'detail', confidence: 0.80 })
  })

  it('classifies detail sheets', () => {
    const result = classifyPlanFile('Window Detail Sheet.pdf')
    expect(result).toEqual({ planType: 'detail', confidence: 0.80 })
  })

  it('uses folderCategory as additional context', () => {
    // File name alone doesn't match, but folder gives context
    const result = classifyPlanFile('Sheet A2.pdf', 'architectural drawings')
    expect(result).toEqual({ planType: 'architectural', confidence: 0.85 })
  })

  it('returns null for unrecognized files', () => {
    const result = classifyPlanFile('Random Notes.pdf')
    expect(result).toEqual({ planType: null, confidence: 0 })
  })

  // ─── Exclusions ──────────────────────────────────────────────────────────

  it('excludes product data sheets (PDS)', () => {
    const result = classifyPlanFile('Hunter Panels H-Shield-NB PDS.pdf')
    expect(result).toEqual({ planType: null, confidence: 0 })
  })

  it('excludes installation guides', () => {
    const result = classifyPlanFile('Foam Panel Installation Guide.pdf')
    expect(result).toEqual({ planType: null, confidence: 0 })
  })

  it('excludes installation manuals', () => {
    const result = classifyPlanFile('HVAC Installation Manual.pdf')
    expect(result).toEqual({ planType: null, confidence: 0 })
  })

  it('excludes invoices', () => {
    const result = classifyPlanFile('Invoice-AD-0148.pdf')
    expect(result).toEqual({ planType: null, confidence: 0 })
  })

  it('excludes receipts', () => {
    const result = classifyPlanFile('Receipt-2026-0301.pdf')
    expect(result).toEqual({ planType: null, confidence: 0 })
  })

  it('excludes agreements', () => {
    const result = classifyPlanFile('Consulting Services Agreement.pdf')
    expect(result).toEqual({ planType: null, confidence: 0 })
  })

  it('excludes DocuSign documents', () => {
    const result = classifyPlanFile('Docusign Structural Engineering.pdf')
    expect(result).toEqual({ planType: null, confidence: 0 })
  })

  it('excludes application forms', () => {
    const result = classifyPlanFile('Permit Application Form.pdf')
    expect(result).toEqual({ planType: null, confidence: 0 })
  })

  it('does NOT classify "plumbing fixture" as plumbing (negative lookahead)', () => {
    const result = classifyPlanFile('Plumbing Fixture Selections.pdf')
    expect(result.planType).not.toBe('plumbing')
  })
})

// ─── discoverLatestPlans ─────────────────────────────────────────────────────

describe('discoverLatestPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('picks the highest version per plan type from multiple revisions', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        file_path: '/plans/Foundation Plan.pdf',
        file_name: 'Foundation Plan.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-01T00:00:00Z',
        folder_category: 'plans',
        agent_domain: 'takeoff',
      },
      {
        id: 'file-2',
        file_path: '/plans/Foundation Plan REV1.pdf',
        file_name: 'Foundation Plan REV1.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-15T00:00:00Z',
        folder_category: 'plans',
        agent_domain: 'takeoff',
      },
      {
        id: 'file-3',
        file_path: '/plans/Foundation Plan REV3.pdf',
        file_name: 'Foundation Plan REV3.pdf',
        file_type: 'pdf',
        modified_at: '2026-02-01T00:00:00Z',
        folder_category: 'plans',
        agent_domain: 'takeoff',
      },
      {
        id: 'file-4',
        file_path: '/plans/Foundation Plan REV2.pdf',
        file_name: 'Foundation Plan REV2.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-20T00:00:00Z',
        folder_category: 'plans',
        agent_domain: 'takeoff',
      },
    ]

    // Configure mock to resolve with our data
    mockSetup.result.data = mockFiles
    mockSetup.result.error = null

    const result = await discoverLatestPlans('proj-001')

    // Should pick REV3 as the latest foundation plan
    expect(result.plans['foundation']).toBeDefined()
    expect(result.plans['foundation'].fileId).toBe('file-3')
    expect(result.plans['foundation'].version).toBe(3)
    expect(result.plans['foundation'].versionLabel).toBe('REV3')

    // All 4 files should appear in allVersions
    expect(result.allVersions).toHaveLength(4)
  })

  it('returns multiple plan types when different types are present', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        file_path: '/plans/Foundation Plan.pdf',
        file_name: 'Foundation Plan.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-01T00:00:00Z',
        folder_category: null,
        agent_domain: 'takeoff',
      },
      {
        id: 'file-2',
        file_path: '/plans/Front Elevation.pdf',
        file_name: 'Front Elevation.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-15T00:00:00Z',
        folder_category: null,
        agent_domain: 'takeoff',
      },
      {
        id: 'file-3',
        file_path: '/plans/Drainage Plan.pdf',
        file_name: 'Drainage Plan.pdf',
        file_type: 'pdf',
        modified_at: '2026-02-01T00:00:00Z',
        folder_category: null,
        agent_domain: 'takeoff',
      },
    ]

    mockSetup.result.data = mockFiles
    mockSetup.result.error = null

    const result = await discoverLatestPlans('proj-001')

    expect(result.plans['foundation']).toBeDefined()
    expect(result.plans['architectural']).toBeDefined()
    expect(result.plans['site']).toBeDefined()
    expect(Object.keys(result.plans)).toHaveLength(3)
  })

  it('reports missing types when not all plan types are found', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        file_path: '/plans/Foundation Plan.pdf',
        file_name: 'Foundation Plan.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-01T00:00:00Z',
        folder_category: null,
        agent_domain: 'takeoff',
      },
    ]

    mockSetup.result.data = mockFiles
    mockSetup.result.error = null

    const result = await discoverLatestPlans('proj-001')

    // Only foundation found
    expect(Object.keys(result.plans)).toEqual(['foundation'])

    // All others should be missing
    expect(result.missingTypes).toContain('architectural')
    expect(result.missingTypes).toContain('structural')
    expect(result.missingTypes).toContain('detail')
    expect(result.missingTypes).toContain('site')
    expect(result.missingTypes).toContain('electrical')
    expect(result.missingTypes).toContain('mechanical')
    expect(result.missingTypes).toContain('plumbing')
    expect(result.missingTypes).not.toContain('foundation')
  })

  it('returns electrical in missingTypes when no electrical plans exist', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        file_path: '/plans/Foundation Plan.pdf',
        file_name: 'Foundation Plan.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-01T00:00:00Z',
        folder_category: null,
        agent_domain: 'takeoff',
      },
      {
        id: 'file-2',
        file_path: '/plans/Main House Structural.pdf',
        file_name: 'Main House Structural.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-15T00:00:00Z',
        folder_category: null,
        agent_domain: 'takeoff',
      },
    ]

    mockSetup.result.data = mockFiles
    mockSetup.result.error = null

    const result = await discoverLatestPlans('proj-001')

    expect(result.missingTypes).toContain('electrical')
  })

  it('skips files that do not match any plan classification', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        file_path: '/plans/Foundation Plan.pdf',
        file_name: 'Foundation Plan.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-01T00:00:00Z',
        folder_category: null,
        agent_domain: 'takeoff',
      },
      {
        id: 'file-2',
        file_path: '/plans/Hunter Panels H-Shield-NB PDS.pdf',
        file_name: 'Hunter Panels H-Shield-NB PDS.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-15T00:00:00Z',
        folder_category: null,
        agent_domain: 'takeoff',
      },
      {
        id: 'file-3',
        file_path: '/plans/Random Meeting Notes.pdf',
        file_name: 'Random Meeting Notes.pdf',
        file_type: 'pdf',
        modified_at: '2026-01-20T00:00:00Z',
        folder_category: null,
        agent_domain: 'takeoff',
      },
    ]

    mockSetup.result.data = mockFiles
    mockSetup.result.error = null

    const result = await discoverLatestPlans('proj-001')

    // Only the foundation plan should be classified
    expect(result.allVersions).toHaveLength(1)
    expect(result.allVersions[0].planType).toBe('foundation')
  })

  it('returns empty results on database error', async () => {
    mockSetup.result.data = null
    mockSetup.result.error = { message: 'Database unavailable' }

    const result = await discoverLatestPlans('proj-001')

    expect(result.plans).toEqual({})
    expect(result.allVersions).toEqual([])
    expect(result.missingTypes).toEqual([...ALL_PLAN_TYPES])
  })

  it('queries file_inventory with correct filters', async () => {
    mockSetup.result.data = []
    mockSetup.result.error = null

    await discoverLatestPlans('proj-001')

    expect(chain.from).toHaveBeenCalledWith('file_inventory')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('project_id', 'proj-001')
    expect(chain.eq).toHaveBeenCalledWith('agent_domain', 'takeoff')
    expect(chain.in).toHaveBeenCalledWith('file_type', ['pdf', 'png', 'jpg', 'jpeg'])
  })
})
