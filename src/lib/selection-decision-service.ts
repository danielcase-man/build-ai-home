/**
 * Selection Decision Queue Service
 *
 * Deterministic (no AI calls) — partitions categories into three zones:
 *   1. Decision Queue: categories with bids but no selected vendor
 *   2. Locked In: categories with a selected vendor
 *   3. Future: categories with no bids (future phases)
 *
 * Sorted by urgency derived from phase proximity and lead-time alerts.
 */

import { getSelections } from './selections-service'
import { getBids } from './bids-service'
import { getAllCategoryMappings } from './category-mapping'
import { getActivePhase } from './workflow-service'
import { getLeadTimeAlerts } from './workflow-service'
import { CONSTRUCTION_PHASES } from './construction-phases'
import type {
  DecisionQueueCategory,
  DecisionQueueBid,
  DecisionQueueResult,
  DecisionUrgency,
  SelectionStatus,
} from '@/types'

const URGENCY_ORDER: DecisionUrgency[] = ['urgent', 'high', 'medium', 'low', 'none']

function urgencyRank(u: DecisionUrgency): number {
  return URGENCY_ORDER.indexOf(u)
}

function phaseNameForNumber(phaseNum: number): string {
  return CONSTRUCTION_PHASES.find(p => p.phase === phaseNum)?.name ?? `Phase ${phaseNum}`
}

export async function getSelectionDecisionQueue(
  projectId: string
): Promise<DecisionQueueResult> {
  // Fetch all data in parallel — no AI, all deterministic
  const [selections, bids, activePhase, alerts] = await Promise.all([
    getSelections(projectId),
    getBids(projectId),
    getActivePhase(projectId),
    getLeadTimeAlerts(projectId),
  ])

  const mappings = getAllCategoryMappings()
  const activePhaseNum = activePhase?.phase_number ?? null
  const activePhaseName = activePhase?.name ?? null

  // Index lead-time alerts by selection category
  const alertByCategory = new Map<string, (typeof alerts)[0]>()
  for (const alert of alerts) {
    // Find the selection to get the category
    const sel = selections.find(s => s.id === alert.selection_id)
    if (sel && (!alertByCategory.has(sel.category) || urgencyRank(alert.priority) < urgencyRank(alertByCategory.get(sel.category)!.priority))) {
      alertByCategory.set(sel.category, alert)
    }
  }

  // Group bids by their mapped selection category
  const bidsByCategory = new Map<string, DecisionQueueBid[]>()
  for (const bid of bids) {
    // Match bid.category to the category mapping's bidCategory
    const mapping = mappings.find(
      m => m.bidCategory.toLowerCase() === bid.category.toLowerCase()
    )
    const key = mapping?.selectionCategory ?? bid.category.toLowerCase()
    const existing = bidsByCategory.get(key) || []
    existing.push({
      bidId: bid.id,
      vendorName: bid.vendor_name,
      totalAmount: bid.total_amount,
      leadTimeWeeks: bid.lead_time_weeks,
      status: bid.status,
      pros: bid.pros,
      cons: bid.cons,
    })
    bidsByCategory.set(key, existing)
  }

  // Group selections by category and compute status summary
  const selectionsByCategory = new Map<string, typeof selections>()
  for (const sel of selections) {
    const existing = selectionsByCategory.get(sel.category) || []
    existing.push(sel)
    selectionsByCategory.set(sel.category, existing)
  }

  // Build categories from the mapping table
  const decisionQueue: DecisionQueueCategory[] = []
  const lockedIn: DecisionQueueCategory[] = []
  const future: DecisionQueueCategory[] = []

  for (const mapping of mappings) {
    const cat = mapping.selectionCategory
    const catBids = bidsByCategory.get(cat) || []
    const catSelections = selectionsByCategory.get(cat) || []

    // Status summary: count of selections per status
    const statusSummary: Partial<Record<SelectionStatus, number>> = {}
    for (const sel of catSelections) {
      statusSummary[sel.status] = (statusSummary[sel.status] || 0) + 1
    }

    // Check if there's a selected vendor (a bid with status 'selected')
    const selectedBid = catBids.find(b => b.status === 'selected')

    // Build lead-time alert shape
    const alert = alertByCategory.get(cat)
    const leadTimeAlert = alert
      ? {
          priority: alert.priority,
          title: alert.title,
          message: alert.message,
          order_by_date: alert.order_by_date,
        }
      : undefined

    // Compute urgency
    let urgency: DecisionUrgency = 'none'
    let urgencyReason: string | undefined

    if (selectedBid) {
      // Locked in — urgency comes only from lead-time alerts
      if (alert) {
        urgency = alert.priority as DecisionUrgency
        urgencyReason = alert.message
      }
    } else if (catBids.length > 0) {
      // Has bids, no selection yet — urgency from phase + lead-time
      if (alert) {
        urgency = alert.priority as DecisionUrgency
        urgencyReason = alert.message
      } else if (activePhaseNum !== null && mapping.phase <= activePhaseNum) {
        urgency = 'high'
        urgencyReason = `Phase ${mapping.phase} (${phaseNameForNumber(mapping.phase)}) is at or before the active phase`
      } else if (activePhaseNum !== null && mapping.phase === activePhaseNum + 1) {
        urgency = 'medium'
        urgencyReason = `Phase ${mapping.phase} (${phaseNameForNumber(mapping.phase)}) is next`
      } else {
        urgency = 'low'
      }
    }
    // Future categories (no bids) stay at 'none'

    const entry: DecisionQueueCategory = {
      category: cat,
      bidCategory: mapping.bidCategory,
      phase: mapping.phase,
      phaseName: phaseNameForNumber(mapping.phase),
      zone: selectedBid ? 'locked' : catBids.length > 0 ? 'decision' : 'future',
      urgency,
      urgencyReason,
      bids: catBids,
      selectedBid,
      selectionCount: catSelections.filter(s => s.status !== 'alternative').length,
      statusSummary,
      leadTimeAlert,
    }

    if (entry.zone === 'locked') {
      lockedIn.push(entry)
    } else if (entry.zone === 'decision') {
      decisionQueue.push(entry)
    } else {
      future.push(entry)
    }
  }

  // Sort: decision queue by urgency then phase
  const sortFn = (a: DecisionQueueCategory, b: DecisionQueueCategory) => {
    const urgDiff = urgencyRank(a.urgency) - urgencyRank(b.urgency)
    if (urgDiff !== 0) return urgDiff
    return a.phase - b.phase
  }

  decisionQueue.sort(sortFn)
  lockedIn.sort(sortFn)
  future.sort((a, b) => a.phase - b.phase)

  return { decisionQueue, lockedIn, future, activePhase: activePhaseNum, activePhaseName }
}
