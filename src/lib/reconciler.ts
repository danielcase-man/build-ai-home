/**
 * Project State Reconciler — deterministic, evidence-based state updates.
 *
 * Reads bids, vendors, selections, documents, contacts, permits, and loan data,
 * then updates milestones, planning steps, and vendor statuses based on hard evidence.
 * NO AI, NO hallucinations — purely rule-driven forward-only progression.
 *
 * Every change is audit-logged with actor='reconciler' and a human-readable reason.
 */

import { supabase } from './supabase'
import { logChange } from './audit-service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconcilerChange {
  entity_type: 'milestone' | 'planning_step' | 'vendor'
  entity_id: string
  entity_name: string
  field: string
  old_value: string
  new_value: string
  reason: string
}

export interface ReconcilerResult {
  changes: ReconcilerChange[]
  skipped: number
  errors: string[]
  duration: number
}

interface Evidence {
  milestones: Array<{ id: string; name: string; status: string; notes: string | null }>
  planningSteps: Array<{ id: string; step_number: number; name: string; status: string; notes: string | null }>
  vendors: Array<{ id: string; company_name: string; category: string | null; status: string | null; notes: string | null }>
  bids: Array<{ id: string; vendor_name: string; category: string; status: string }>
  selections: Array<{ id: string; category: string; status: string }>
  documents: Array<{ id: string; name: string; category: string | null }>
  contacts: Array<{ id: string; name: string; company: string | null; role: string | null }>
  permits: Array<{ id: string; type: string; status: string }>
  loan: { application_status: string } | null
}

interface StatusRecommendation {
  status: string
  reason: string
}

// ---------------------------------------------------------------------------
// Status progression guards (forward-only)
// ---------------------------------------------------------------------------

const MILESTONE_ORDER = ['pending', 'in_progress', 'completed']
const PLANNING_ORDER = ['not_started', 'in_progress', 'completed']
const VENDOR_ORDER = ['potential', 'approved', 'active', 'completed']

function isForwardProgression(current: string, proposed: string, order: string[]): boolean {
  const currentIdx = order.indexOf(current)
  const proposedIdx = order.indexOf(proposed)
  if (currentIdx === -1 || proposedIdx === -1) return false
  return proposedIdx > currentIdx
}

function isLocked(notes: string | null): boolean {
  return (notes || '').includes('[locked]')
}

// ---------------------------------------------------------------------------
// Milestone rule definitions
// ---------------------------------------------------------------------------

/** Bid categories that map to each construction phase */
const PHASE_BID_CATEGORIES: Record<string, string[]> = {
  'pre-construction': ['Site Work', 'Well & Septic', 'Civil Engineering', 'Surveying', 'Foundation Engineering', 'Temporary Utilities'],
  'site preparation': ['Site Work'],
  'foundation': ['Foundation'],
  'framing': ['Framing', 'Trusses'],
  'roofing': ['Roofing'],
  'rough-in': ['HVAC', 'Plumbing Rough', 'Electrical'],
  'exterior': ['Windows & Doors', 'Siding', 'Insulation', 'Stone & Masonry'],
  'insulation': ['Insulation'],
  'drywall': ['Drywall'],
  'interior': ['Doors & Trim', 'Painting', 'Cabinetry', 'Countertops', 'Tile', 'Flooring'],
  'mep-finishes': ['Plumbing Fixtures', 'Lighting Fixtures', 'Appliances'],
  'exterior-site': ['Driveway', 'Garage Doors', 'Exterior Lighting'],
}

type MilestoneRule = (ev: Evidence) => StatusRecommendation | null

function hasBidInCategories(bids: Evidence['bids'], categories: string[], statuses?: string[]): boolean {
  const validStatuses = statuses || ['pending', 'under_review', 'selected']
  return bids.some(b =>
    categories.some(c => b.category.toLowerCase().includes(c.toLowerCase())) &&
    validStatuses.includes(b.status)
  )
}

function hasSelectedBidInCategories(bids: Evidence['bids'], categories: string[]): boolean {
  return hasBidInCategories(bids, categories, ['selected'])
}

function hasVendorWithCategory(vendors: Evidence['vendors'], keywords: string[], statuses?: string[]): boolean {
  return vendors.some(v =>
    keywords.some(k => (v.category || '').toLowerCase().includes(k.toLowerCase())) &&
    (!statuses || statuses.includes(v.status || ''))
  )
}

function hasDocumentsMatching(docs: Evidence['documents'], keywords: string[]): boolean {
  return docs.some(d =>
    keywords.some(k =>
      (d.name || '').toLowerCase().includes(k.toLowerCase()) ||
      (d.category || '').toLowerCase().includes(k.toLowerCase())
    )
  )
}

const MILESTONE_RULES: Array<{ pattern: RegExp; rule: MilestoneRule }> = [
  {
    pattern: /pre.?construction/i,
    rule: (ev) => {
      const cats = PHASE_BID_CATEGORIES['pre-construction']
      if (hasSelectedBidInCategories(ev.bids, cats)) {
        const selectedCats = cats.filter(c => ev.bids.some(b => b.category.toLowerCase().includes(c.toLowerCase()) && b.status === 'selected'))
        return { status: 'in_progress', reason: `Selected bids in: ${selectedCats.join(', ')}` }
      }
      if (hasBidInCategories(ev.bids, cats)) {
        return { status: 'in_progress', reason: 'Bids received for pre-construction trades' }
      }
      return null
    },
  },
  {
    pattern: /design\s*finali/i,
    rule: (ev) => {
      const archDone = hasVendorWithCategory(ev.vendors, ['architect', 'architecture'], ['completed'])
      const structActive = hasVendorWithCategory(ev.vendors, ['structural'], ['active', 'completed'])
      const plansExist = hasDocumentsMatching(ev.documents, ['architectural_plans', 'construction drawings', 'floor plan'])
      if (archDone && plansExist) {
        return { status: 'completed', reason: 'Architect completed + plans documents exist' + (structActive ? ' + structural engineering active' : '') }
      }
      if (hasVendorWithCategory(ev.vendors, ['architect', 'architecture'])) {
        return { status: 'in_progress', reason: 'Architect vendor engaged' }
      }
      return null
    },
  },
  {
    pattern: /permit/i,
    rule: (ev) => {
      if (ev.permits.length === 0) return null
      const allApproved = ev.permits.every(p => p.status === 'approved')
      if (allApproved) return { status: 'completed', reason: `All ${ev.permits.length} permits approved` }
      const anyActive = ev.permits.some(p => ['submitted', 'in_review', 'in_progress'].includes(p.status))
      if (anyActive) return { status: 'in_progress', reason: 'Permit applications in progress' }
      return null
    },
  },
  {
    pattern: /procurement|bidding/i,
    rule: (ev) => {
      const selectedBids = ev.bids.filter(b => b.status === 'selected')
      const reviewBids = ev.bids.filter(b => b.status === 'under_review')
      if (selectedBids.length > 0 || reviewBids.length > 0) {
        return {
          status: 'in_progress',
          reason: `${selectedBids.length} bids selected, ${reviewBids.length} under review out of ${ev.bids.length} total`,
        }
      }
      if (ev.bids.length > 0) {
        return { status: 'in_progress', reason: `${ev.bids.length} bids received` }
      }
      return null
    },
  },
  {
    pattern: /site\s*prep/i,
    rule: (ev) => {
      if (hasVendorWithCategory(ev.vendors, ['site', 'excavation', 'grading'], ['completed'])) {
        return { status: 'completed', reason: 'Site work vendor completed' }
      }
      if (hasSelectedBidInCategories(ev.bids, PHASE_BID_CATEGORIES['site preparation'])) {
        return { status: 'in_progress', reason: 'Site work bid selected' }
      }
      return null
    },
  },
  {
    pattern: /foundation\s*(construction)?$/i,
    rule: (ev) => {
      if (hasVendorWithCategory(ev.vendors, ['foundation'], ['completed'])) {
        return { status: 'completed', reason: 'Foundation vendor completed' }
      }
      if (hasSelectedBidInCategories(ev.bids, PHASE_BID_CATEGORIES['foundation'])) {
        return { status: 'in_progress', reason: 'Foundation bid selected' }
      }
      return null
    },
  },
  {
    pattern: /framing/i,
    rule: (ev) => {
      if (hasVendorWithCategory(ev.vendors, ['framing', 'lumber'], ['completed'])) {
        return { status: 'completed', reason: 'Framing vendor completed' }
      }
      if (hasSelectedBidInCategories(ev.bids, PHASE_BID_CATEGORIES['framing'])) {
        return { status: 'in_progress', reason: 'Framing/truss bid selected' }
      }
      return null
    },
  },
  {
    pattern: /^roofing$/i,
    rule: (ev) => {
      if (hasVendorWithCategory(ev.vendors, ['roofing'], ['completed'])) {
        return { status: 'completed', reason: 'Roofing vendor completed' }
      }
      if (hasSelectedBidInCategories(ev.bids, PHASE_BID_CATEGORIES['roofing'])) {
        return { status: 'in_progress', reason: 'Roofing bid selected' }
      }
      return null
    },
  },
  {
    pattern: /rough.?in|mechanical\s*system/i,
    rule: (ev) => {
      const cats = PHASE_BID_CATEGORIES['rough-in']
      if (hasSelectedBidInCategories(ev.bids, cats)) {
        return { status: 'in_progress', reason: 'MEP rough-in bid(s) selected' }
      }
      return null
    },
  },
  {
    pattern: /exterior\s*finish/i,
    rule: (ev) => {
      const cats = PHASE_BID_CATEGORIES['exterior']
      if (hasSelectedBidInCategories(ev.bids, cats)) {
        return { status: 'in_progress', reason: 'Exterior trade bid(s) selected' }
      }
      return null
    },
  },
  {
    pattern: /insulation/i,
    rule: (ev) => {
      if (hasSelectedBidInCategories(ev.bids, PHASE_BID_CATEGORIES['insulation'])) {
        return { status: 'in_progress', reason: 'Insulation bid selected' }
      }
      return null
    },
  },
  {
    pattern: /drywall/i,
    rule: (ev) => {
      if (hasSelectedBidInCategories(ev.bids, PHASE_BID_CATEGORIES['drywall'])) {
        return { status: 'in_progress', reason: 'Drywall bid selected' }
      }
      return null
    },
  },
  {
    pattern: /interior\s*finish/i,
    rule: (ev) => {
      const cats = PHASE_BID_CATEGORIES['interior']
      const selectedCats = cats.filter(c => ev.bids.some(b => b.category.toLowerCase().includes(c.toLowerCase()) && b.status === 'selected'))
      if (selectedCats.length > 0) {
        return { status: 'in_progress', reason: `Interior finish bids selected: ${selectedCats.join(', ')}` }
      }
      return null
    },
  },
  {
    pattern: /final\s*mechanical|mep\s*finish/i,
    rule: (ev) => {
      const cats = PHASE_BID_CATEGORIES['mep-finishes']
      if (hasSelectedBidInCategories(ev.bids, cats)) {
        return { status: 'in_progress', reason: 'MEP finish bid(s) selected' }
      }
      // Also check if selections are confirmed in these categories
      const confirmedCats = ['plumbing', 'lighting', 'appliance'].filter(c =>
        ev.selections.some(s => s.category === c && s.status === 'selected')
      )
      if (confirmedCats.length > 0) {
        return { status: 'in_progress', reason: `Confirmed selections in: ${confirmedCats.join(', ')}` }
      }
      return null
    },
  },
  {
    pattern: /exterior\s*completion/i,
    rule: (ev) => {
      if (hasSelectedBidInCategories(ev.bids, PHASE_BID_CATEGORIES['exterior-site'])) {
        return { status: 'in_progress', reason: 'Exterior/site bid(s) selected' }
      }
      return null
    },
  },
  // Final cleanup and final inspections: manual only — no rules
]

// ---------------------------------------------------------------------------
// Planning step rule definitions
// ---------------------------------------------------------------------------

type PlanningStepRule = (ev: Evidence) => StatusRecommendation | null

const PLANNING_STEP_RULES: Record<number, PlanningStepRule> = {
  1: (ev) => {
    // Step 1 (Consultation): completed when UBuildIt consultant contact exists
    const hasConsultant = ev.contacts.some(c =>
      (c.company || '').toLowerCase().includes('ubuildit') ||
      (c.role || '').toLowerCase().includes('consultant')
    )
    if (hasConsultant) return { status: 'completed', reason: 'UBuildIt consultant contact established' }
    return null
  },
  2: (ev) => {
    // Step 2 (Lot Analysis): completed when survey/site docs exist
    const hasSiteDocs = hasDocumentsMatching(ev.documents, ['survey', 'soil', 'topographic', 'plat', 'lot analysis', 'site visit'])
    if (hasSiteDocs) return { status: 'completed', reason: 'Site/survey documents exist' }
    return null
  },
  3: (ev) => {
    // Step 3 (Plan Development): completed when architect done + plans exist
    const archDone = hasVendorWithCategory(ev.vendors, ['architect', 'architecture'], ['completed'])
    const plansExist = hasDocumentsMatching(ev.documents, ['architectural_plans', 'construction drawings', 'floor plan'])
    if (archDone && plansExist) return { status: 'completed', reason: 'Architect completed + plans uploaded' }
    if (hasVendorWithCategory(ev.vendors, ['architect', 'architecture'])) {
      return { status: 'in_progress', reason: 'Architect vendor engaged' }
    }
    return null
  },
  4: (ev) => {
    // Step 4 (Estimating/Bidding): in_progress when bids exist; completed when most categories covered
    if (ev.bids.length === 0) return null
    const selectedCount = ev.bids.filter(b => b.status === 'selected').length
    const uniqueCategories = new Set(ev.bids.map(b => b.category))
    // Major categories that need bids (simplified)
    const majorCategories = ['Foundation', 'Framing', 'Roofing', 'HVAC', 'Plumbing', 'Electrical',
      'Windows', 'Insulation', 'Drywall', 'Flooring', 'Cabinetry', 'Painting']
    const coveredMajor = majorCategories.filter(mc =>
      ev.bids.some(b => b.category.toLowerCase().includes(mc.toLowerCase()))
    )
    if (coveredMajor.length >= majorCategories.length * 0.8) {
      return { status: 'completed', reason: `${coveredMajor.length}/${majorCategories.length} major categories have bids` }
    }
    return {
      status: 'in_progress',
      reason: `${ev.bids.length} bids across ${uniqueCategories.size} categories (${selectedCount} selected)`,
    }
  },
  5: (ev) => {
    // Step 5 (Financing): in_progress when loan exists, completed when approved/funded
    if (!ev.loan) return null
    if (['approved', 'funded'].includes(ev.loan.application_status)) {
      return { status: 'completed', reason: `Construction loan ${ev.loan.application_status}` }
    }
    if (['not_started'].includes(ev.loan.application_status)) return null
    return { status: 'in_progress', reason: `Loan application status: ${ev.loan.application_status}` }
  },
  6: (_ev) => {
    // Step 6 (Pre-construction Meeting): NEVER auto-completed
    return null
  },
}

// ---------------------------------------------------------------------------
// The reconciler
// ---------------------------------------------------------------------------

export class ProjectReconciler {
  private projectId: string
  private changes: ReconcilerChange[] = []
  private errors: string[] = []
  private skipped = 0

  constructor(projectId: string) {
    this.projectId = projectId
  }

  async reconcileAll(): Promise<ReconcilerResult> {
    const start = Date.now()

    try {
      const evidence = await this.loadEvidence()

      await this.reconcileMilestones(evidence)
      await this.reconcilePlanningSteps(evidence)
      await this.reconcileVendorStatuses(evidence)
    } catch (err) {
      this.errors.push(err instanceof Error ? err.message : String(err))
    }

    return {
      changes: this.changes,
      skipped: this.skipped,
      errors: this.errors,
      duration: Date.now() - start,
    }
  }

  private async loadEvidence(): Promise<Evidence> {
    const pid = this.projectId

    const [milestones, planningSteps, vendors, bids, selections, documents, contacts, permits, loans] =
      await Promise.all([
        supabase.from('milestones').select('id, name, status, notes').eq('project_id', pid).then(r => r.data || []),
        supabase.from('planning_phase_steps').select('id, step_number, name, status, notes').eq('project_id', pid).order('step_number').then(r => r.data || []),
        supabase.from('vendors').select('id, company_name, category, status, notes').eq('project_id', pid).then(r => r.data || []),
        supabase.from('bids').select('id, vendor_name, category, status').eq('project_id', pid).then(r => r.data || []),
        supabase.from('selections').select('id, category, status').eq('project_id', pid).then(r => r.data || []),
        supabase.from('documents').select('id, name, category').eq('project_id', pid).then(r => r.data || []),
        supabase.from('contacts').select('id, name, company, role').eq('project_id', pid).then(r => r.data || []),
        supabase.from('permits').select('id, type, status').eq('project_id', pid).then(r => r.data || []),
        supabase.from('construction_loans').select('application_status').eq('project_id', pid).eq('is_active', true).limit(1).then(r => r.data),
      ])

    return {
      milestones,
      planningSteps,
      vendors,
      bids,
      selections,
      documents,
      contacts,
      permits,
      loan: loans && loans.length > 0 ? loans[0] : null,
    }
  }

  private async reconcileMilestones(ev: Evidence): Promise<void> {
    for (const milestone of ev.milestones) {
      if (isLocked(milestone.notes)) {
        this.skipped++
        continue
      }

      // Find matching rule
      const ruleEntry = MILESTONE_RULES.find(r => r.pattern.test(milestone.name))
      if (!ruleEntry) {
        this.skipped++
        continue
      }

      const recommendation = ruleEntry.rule(ev)
      if (!recommendation) {
        this.skipped++
        continue
      }

      if (!isForwardProgression(milestone.status, recommendation.status, MILESTONE_ORDER)) {
        this.skipped++
        continue
      }

      // Apply the update
      try {
        const { error } = await supabase
          .from('milestones')
          .update({ status: recommendation.status, updated_at: new Date().toISOString() })
          .eq('id', milestone.id)

        if (error) {
          this.errors.push(`Milestone ${milestone.name}: ${error.message}`)
          continue
        }

        const change: ReconcilerChange = {
          entity_type: 'milestone',
          entity_id: milestone.id,
          entity_name: milestone.name,
          field: 'status',
          old_value: milestone.status,
          new_value: recommendation.status,
          reason: recommendation.reason,
        }
        this.changes.push(change)

        await logChange({
          projectId: this.projectId,
          entityType: 'milestone',
          entityId: milestone.id,
          action: 'update',
          fieldName: 'status',
          oldValue: milestone.status,
          newValue: recommendation.status,
          actor: 'reconciler',
        })
      } catch (err) {
        this.errors.push(`Milestone ${milestone.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  private async reconcilePlanningSteps(ev: Evidence): Promise<void> {
    for (const step of ev.planningSteps) {
      if (isLocked(step.notes)) {
        this.skipped++
        continue
      }

      const rule = PLANNING_STEP_RULES[step.step_number]
      if (!rule) {
        this.skipped++
        continue
      }

      const recommendation = rule(ev)
      if (!recommendation) {
        this.skipped++
        continue
      }

      if (!isForwardProgression(step.status, recommendation.status, PLANNING_ORDER)) {
        this.skipped++
        continue
      }

      try {
        const { error } = await supabase
          .from('planning_phase_steps')
          .update({ status: recommendation.status, updated_at: new Date().toISOString() })
          .eq('id', step.id)

        if (error) {
          this.errors.push(`Planning step ${step.step_number}: ${error.message}`)
          continue
        }

        const change: ReconcilerChange = {
          entity_type: 'planning_step',
          entity_id: step.id,
          entity_name: `Step ${step.step_number}: ${step.name || '(unnamed)'}`,
          field: 'status',
          old_value: step.status,
          new_value: recommendation.status,
          reason: recommendation.reason,
        }
        this.changes.push(change)

        await logChange({
          projectId: this.projectId,
          entityType: 'planning_step',
          entityId: step.id,
          action: 'update',
          fieldName: 'status',
          oldValue: step.status,
          newValue: recommendation.status,
          actor: 'reconciler',
        })
      } catch (err) {
        this.errors.push(`Planning step ${step.step_number}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  private async reconcileVendorStatuses(ev: Evidence): Promise<void> {
    for (const vendor of ev.vendors) {
      if (isLocked(vendor.notes)) {
        this.skipped++
        continue
      }

      // Find bids associated with this vendor (by name match)
      const vendorBids = ev.bids.filter(b =>
        b.vendor_name.toLowerCase().includes(vendor.company_name.toLowerCase()) ||
        vendor.company_name.toLowerCase().includes(b.vendor_name.toLowerCase())
      )

      let recommendation: StatusRecommendation | null = null

      // If vendor has a selected bid, should be 'active'
      const hasSelected = vendorBids.some(b => b.status === 'selected')
      if (hasSelected && (vendor.status === 'potential' || vendor.status === null)) {
        recommendation = {
          status: 'active',
          reason: `Has selected bid: ${vendorBids.filter(b => b.status === 'selected').map(b => b.category).join(', ')}`,
        }
      }

      if (!recommendation) {
        this.skipped++
        continue
      }

      if (!isForwardProgression(vendor.status || 'potential', recommendation.status, VENDOR_ORDER)) {
        this.skipped++
        continue
      }

      try {
        const { error } = await supabase
          .from('vendors')
          .update({ status: recommendation.status, updated_at: new Date().toISOString() })
          .eq('id', vendor.id)

        if (error) {
          this.errors.push(`Vendor ${vendor.company_name}: ${error.message}`)
          continue
        }

        const change: ReconcilerChange = {
          entity_type: 'vendor',
          entity_id: vendor.id,
          entity_name: vendor.company_name,
          field: 'status',
          old_value: vendor.status || 'potential',
          new_value: recommendation.status,
          reason: recommendation.reason,
        }
        this.changes.push(change)

        await logChange({
          projectId: this.projectId,
          entityType: 'vendor',
          entityId: vendor.id,
          action: 'update',
          fieldName: 'status',
          oldValue: vendor.status,
          newValue: recommendation.status,
          actor: 'reconciler',
        })
      } catch (err) {
        this.errors.push(`Vendor ${vendor.company_name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
}
