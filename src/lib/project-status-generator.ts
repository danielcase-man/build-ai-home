/**
 * Deterministic Project Status Generator — Phase 2 replacement for AI status snapshots.
 *
 * Produces the same ProjectStatusSnapshot shape from structured DB data.
 * No AI API calls. Every fact comes from the database, not email interpretation.
 *
 * Hot topics → blocked milestones, overdue tasks, expiring bids, budget overages
 * Action items → pending tasks, upcoming deadlines, unanswered contacts
 * Recent decisions → bid selections, status changes in last 7 days
 * Next steps → next milestones, pending tasks by priority
 * Open questions → (deferred to Claude Code — requires email NLP)
 * Key data points → budget, bid counts, milestone dates, phase info
 * AI summary → template narrative (Claude Code enriches later)
 */

import type { FullProjectContext, ProjectStatusSnapshot } from './ai-summarization'

const TODAY = () => new Date().toISOString().split('T')[0]
const DAYS_AGO = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Hot Topics — what needs attention RIGHT NOW
// ---------------------------------------------------------------------------

function deriveHotTopics(ctx: FullProjectContext): ProjectStatusSnapshot['hot_topics'] {
  const topics: ProjectStatusSnapshot['hot_topics'] = []
  const today = TODAY()

  // Blocked milestones
  const blocked = ctx.milestones.filter(m => m.status === 'blocked')
  for (const m of blocked) {
    topics.push({ priority: 'high', text: `${m.name} is BLOCKED${m.notes ? `: ${m.notes}` : ''}` })
  }

  // Overdue tasks
  const overdueTasks = ctx.tasks.filter(t =>
    t.status !== 'completed' && t.due_date && t.due_date < today
  )
  if (overdueTasks.length > 0) {
    topics.push({
      priority: 'high',
      text: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}: ${overdueTasks.slice(0, 3).map(t => t.title).join(', ')}${overdueTasks.length > 3 ? '...' : ''}`
    })
  }

  // Budget overage
  if (ctx.budget.total > 0 && ctx.budget.spent > ctx.budget.total) {
    const overage = ctx.budget.spent - ctx.budget.total
    topics.push({
      priority: 'high',
      text: `Budget over by $${overage.toLocaleString()} (${Math.round((ctx.budget.spent / ctx.budget.total) * 100)}% of $${ctx.budget.total.toLocaleString()})`
    })
  }

  // Expiring bids (within 14 days)
  const fourteenDaysOut = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().split('T')[0] })()
  const expiringBids = ctx.bids.filter(b =>
    b.status === 'pending' && b.valid_until && b.valid_until <= fourteenDaysOut && b.valid_until >= today
  )
  if (expiringBids.length > 0) {
    topics.push({
      priority: 'medium',
      text: `${expiringBids.length} bid${expiringBids.length > 1 ? 's' : ''} expiring soon: ${expiringBids.map(b => `${b.vendor_name} (${b.valid_until})`).join(', ')}`
    })
  }

  // Stale bids — pending/under_review for 30+ days need a decision
  const thirtyDaysAgo = DAYS_AGO(30)
  const staleBids = ctx.bids.filter(b =>
    (b.status === 'pending' || b.status === 'under_review') &&
    b.received_date && b.received_date < thirtyDaysAgo
  )
  if (staleBids.length > 0) {
    // Group by category for cleaner output
    const staleByCategory: Record<string, typeof staleBids> = {}
    for (const b of staleBids) {
      if (!staleByCategory[b.category]) staleByCategory[b.category] = []
      staleByCategory[b.category].push(b)
    }
    for (const [cat, bids] of Object.entries(staleByCategory)) {
      const oldest = Math.max(...bids.map(b => Math.floor((Date.now() - new Date(b.received_date).getTime()) / 86400000)))
      topics.push({
        priority: oldest > 90 ? 'high' : 'medium',
        text: `${bids.length} stale ${cat} bid${bids.length > 1 ? 's' : ''} (${bids.map(b => b.vendor_name).join(', ')}) — ${oldest > 90 ? `${oldest}+ days` : '30+ days'} with no decision`
      })
    }
  }

  // Critical trades with NO bids at all
  const criticalTrades = ['Framing', 'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Insulation', 'Drywall', 'Cabinetry']
  const categoriesWithBids = new Set(ctx.bids.filter(b => b.status !== 'rejected').map(b => b.category))
  const missingBids = criticalTrades.filter(t => !categoriesWithBids.has(t))
  if (missingBids.length > 0) {
    topics.push({
      priority: 'medium',
      text: `No bids yet for critical trades: ${missingBids.join(', ')}`
    })
  }

  // Permits pending
  const pendingPermits = ctx.permits.filter(p => p.status === 'pending' || p.status === 'submitted')
  if (pendingPermits.length > 0) {
    topics.push({
      priority: 'medium',
      text: `${pendingPermits.length} permit${pendingPermits.length > 1 ? 's' : ''} pending: ${pendingPermits.map(p => p.type).join(', ')}`
    })
  }

  // Loan status (if not funded)
  if (ctx.loan && ctx.loan.application_status !== 'funded' && ctx.loan.application_status !== 'approved') {
    topics.push({
      priority: 'medium',
      text: `Construction loan status: ${ctx.loan.application_status.replace(/_/g, ' ')} (${ctx.loan.lender_name})`
    })
  }

  // Expiring warranties
  if (ctx.expiringWarranties && ctx.expiringWarranties.length > 0) {
    topics.push({
      priority: 'low',
      text: `${ctx.expiringWarranties.length} warranty/warranties expiring: ${ctx.expiringWarranties.map(w => `${w.vendor} ${w.category}`).join(', ')}`
    })
  }

  // Compliance gaps
  if (ctx.complianceGaps && (ctx.complianceGaps.expired > 0 || ctx.complianceGaps.expiring_soon > 0)) {
    topics.push({
      priority: ctx.complianceGaps.expired > 0 ? 'high' : 'medium',
      text: `Subcontractor compliance: ${ctx.complianceGaps.expired} expired, ${ctx.complianceGaps.expiring_soon} expiring soon`
    })
  }

  return topics.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return (order[a.priority as keyof typeof order] ?? 3) - (order[b.priority as keyof typeof order] ?? 3)
  })
}

// ---------------------------------------------------------------------------
// Action Items — what needs to be done
// ---------------------------------------------------------------------------

function deriveActionItems(ctx: FullProjectContext): ProjectStatusSnapshot['action_items'] {
  const items: ProjectStatusSnapshot['action_items'] = []
  const today = TODAY()

  // Pending/in-progress tasks
  const activeTasks = ctx.tasks
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
    .sort((a, b) => {
      const pOrder = { high: 0, medium: 1, low: 2 }
      return (pOrder[a.priority as keyof typeof pOrder] ?? 3) - (pOrder[b.priority as keyof typeof pOrder] ?? 3)
    })
    .slice(0, 10)

  for (const task of activeTasks) {
    const isOverdue = task.due_date && task.due_date < today
    items.push({
      status: task.status === 'in_progress' ? 'in-progress' : 'pending',
      text: `${task.title}${isOverdue ? ' (OVERDUE)' : ''}${task.due_date ? ` — due ${task.due_date}` : ''}`,
      action_type: null,
      action_context: undefined,
    })
  }

  // Bids needing review (pending status, received recently)
  const pendingBids = ctx.bids.filter(b => b.status === 'pending' || b.status === 'under_review')
  if (pendingBids.length > 0) {
    const categories = [...new Set(pendingBids.map(b => b.category))]
    items.push({
      status: 'pending',
      text: `Review ${pendingBids.length} pending bid${pendingBids.length > 1 ? 's' : ''} across ${categories.join(', ')}`,
      action_type: null,
      action_context: undefined,
    })
  }

  // Categories with bids but no selection — check BOTH bid status and selections table
  const categoriesWithSelections = new Set(
    ctx.selections
      .filter(s => s.status !== 'alternative' && s.status !== 'considering')
      .map(s => s.category)
  )
  const bidCategories = [...new Set(ctx.bids.map(b => b.category))]
  const selectedBidCategories = new Set(ctx.bids.filter(b => b.status === 'selected').map(b => b.category))
  const needsDecision = bidCategories.filter(c =>
    !selectedBidCategories.has(c) &&
    !categoriesWithSelections.has(c.toLowerCase()) &&
    ctx.bids.some(b => b.category === c && b.status !== 'rejected')
  )

  for (const cat of needsDecision) {
    const catBids = ctx.bids.filter(b => b.category === cat && b.status !== 'rejected')
    items.push({
      status: 'pending',
      text: `Select vendor for ${cat} (${catBids.length} bid${catBids.length > 1 ? 's' : ''} available)`,
      action_type: null,
      action_context: undefined,
    })
  }

  // Change orders needing approval
  if (ctx.changeOrders) {
    const pendingCOs = ctx.changeOrders.filter(co => co.status === 'pending' || co.status === 'proposed')
    for (const co of pendingCOs) {
      items.push({
        status: 'pending',
        text: `Approve change order: ${co.title} ($${co.cost_impact.toLocaleString()})`,
        action_type: null,
        action_context: undefined,
      })
    }
  }

  return items
}

// ---------------------------------------------------------------------------
// Recent Decisions — what was decided in the last 7 days
// ---------------------------------------------------------------------------

function deriveRecentDecisions(ctx: FullProjectContext): ProjectStatusSnapshot['recent_decisions'] {
  const decisions: ProjectStatusSnapshot['recent_decisions'] = []
  const sevenDaysAgo = DAYS_AGO(7)

  // Bid selections
  const recentSelections = ctx.bids.filter(b =>
    b.status === 'selected' && b.received_date >= sevenDaysAgo
  )
  for (const bid of recentSelections) {
    decisions.push({
      decision: `Selected ${bid.vendor_name} for ${bid.category} ($${bid.total_amount.toLocaleString()})`,
      impact: bid.selection_notes || `Vendor locked in for ${bid.category}`
    })
  }

  // Recently completed milestones
  const completedMilestones = ctx.milestones.filter(m =>
    m.status === 'completed' && m.completed_date && m.completed_date >= sevenDaysAgo
  )
  for (const m of completedMilestones) {
    decisions.push({
      decision: `Completed milestone: ${m.name}`,
      impact: m.notes || 'Milestone achieved on schedule'
    })
  }

  // Approved change orders
  if (ctx.changeOrders) {
    const approvedCOs = ctx.changeOrders.filter(co => co.status === 'approved')
    for (const co of approvedCOs) {
      decisions.push({
        decision: `Approved change order: ${co.title}`,
        impact: `$${co.cost_impact.toLocaleString()} impact${co.schedule_impact_days ? `, ${co.schedule_impact_days} day schedule impact` : ''}`
      })
    }
  }

  return decisions
}

// ---------------------------------------------------------------------------
// Next Steps — what's coming up
// ---------------------------------------------------------------------------

function deriveNextSteps(ctx: FullProjectContext): string[] {
  const steps: string[] = []

  // Categories that already have a selected vendor (via selections table)
  const categoriesWithSelections = new Set(
    ctx.selections
      .filter(s => s.status !== 'alternative' && s.status !== 'considering')
      .map(s => s.category)
  )

  // Next upcoming milestone
  const upcomingMilestones = ctx.milestones
    .filter(m => m.status === 'pending' || m.status === 'in_progress')
    .sort((a, b) => (a.target_date || '9999').localeCompare(b.target_date || '9999'))

  if (upcomingMilestones.length > 0) {
    const next = upcomingMilestones[0]
    steps.push(`Next milestone: ${next.name}${next.target_date ? ` (target: ${next.target_date})` : ''}`)
  }

  // High-priority pending tasks — skip AI-generated cruft
  const highPriority = ctx.tasks
    .filter(t => t.priority === 'high' && t.status !== 'completed')
    .filter(t => !t.notes?.includes('[ai-generated]'))
    .filter(t => !t.notes?.includes('[auto-closed'))
    .slice(0, 3)

  for (const task of highPriority) {
    steps.push(task.title)
  }

  // Vendor decisions needed — exclude categories that already have selections
  const bidCategories = [...new Set(ctx.bids.map(b => b.category))]
  const selectedBidCategories = new Set(ctx.bids.filter(b => b.status === 'selected').map(b => b.category))
  const needsDecision = bidCategories.filter(c =>
    !selectedBidCategories.has(c) && !categoriesWithSelections.has(c.toLowerCase())
  )
  if (needsDecision.length > 0) {
    steps.push(`Make vendor selections for: ${needsDecision.join(', ')}`)
  }

  // Pending permits
  const pendingPermits = ctx.permits.filter(p => p.status === 'pending')
  if (pendingPermits.length > 0) {
    steps.push(`Follow up on ${pendingPermits.length} pending permit${pendingPermits.length > 1 ? 's' : ''}`)
  }

  return steps
}

// ---------------------------------------------------------------------------
// Key Data Points — numbers that matter
// ---------------------------------------------------------------------------

function deriveKeyDataPoints(ctx: FullProjectContext): ProjectStatusSnapshot['key_data_points'] {
  const points: ProjectStatusSnapshot['key_data_points'] = []

  // Budget
  points.push({
    category: 'Budget',
    data: `$${ctx.budget.spent.toLocaleString()} of $${ctx.budget.total.toLocaleString()} (${ctx.budget.total > 0 ? Math.round((ctx.budget.spent / ctx.budget.total) * 100) : 0}%)`,
    importance: ctx.budget.spent > ctx.budget.total ? 'critical' : 'important',
  })

  // Phase & progress
  points.push({
    category: 'Phase',
    data: `${ctx.project.phase} — Step ${ctx.project.currentStep} of ${ctx.project.totalSteps}`,
    importance: 'important',
  })

  // Bid activity
  const totalBids = ctx.bids.length
  const pendingBids = ctx.bids.filter(b => b.status === 'pending').length
  const selectedBids = ctx.bids.filter(b => b.status === 'selected').length
  if (totalBids > 0) {
    points.push({
      category: 'Bids',
      data: `${totalBids} total, ${pendingBids} pending review, ${selectedBids} selected`,
      importance: pendingBids > 0 ? 'important' : 'info',
    })
  }

  // Loan
  if (ctx.loan) {
    points.push({
      category: 'Loan',
      data: `${ctx.loan.lender_name}: ${ctx.loan.application_status.replace(/_/g, ' ')}${ctx.loan.loan_amount ? ` — $${ctx.loan.loan_amount.toLocaleString()}` : ''}`,
      importance: ctx.loan.application_status === 'funded' ? 'info' : 'important',
    })
  }

  // Tasks summary
  const totalTasks = ctx.tasks.length
  const completedTasks = ctx.tasks.filter(t => t.status === 'completed').length
  if (totalTasks > 0) {
    points.push({
      category: 'Tasks',
      data: `${completedTasks}/${totalTasks} completed (${Math.round((completedTasks / totalTasks) * 100)}%)`,
      importance: 'info',
    })
  }

  // Draw schedule
  if (ctx.drawSchedule) {
    points.push({
      category: 'Draws',
      data: `${ctx.drawSchedule.total_draws} draws, $${ctx.drawSchedule.funded_amount.toLocaleString()} funded, $${ctx.drawSchedule.pending_amount.toLocaleString()} pending`,
      importance: 'info',
    })
  }

  return points
}

// ---------------------------------------------------------------------------
// Summary — template narrative
// ---------------------------------------------------------------------------

function generateTemplateSummary(
  ctx: FullProjectContext,
  hotTopics: ProjectStatusSnapshot['hot_topics'],
  decisions: ProjectStatusSnapshot['recent_decisions']
): string {
  const parts: string[] = []

  // Opening: phase and progress
  parts.push(`The ${ctx.project.name} project is in the ${ctx.project.phase} phase (Step ${ctx.project.currentStep} of ${ctx.project.totalSteps}).`)

  // Budget status
  if (ctx.budget.total > 0) {
    const pct = Math.round((ctx.budget.spent / ctx.budget.total) * 100)
    const status = ctx.budget.spent <= ctx.budget.total ? 'on track' : 'over budget'
    parts.push(`Budget is ${status} at $${ctx.budget.spent.toLocaleString()} of $${ctx.budget.total.toLocaleString()} (${pct}%).`)
  }

  // Recent decisions
  if (decisions.length > 0) {
    parts.push(`Recent decisions: ${decisions.map(d => d.decision).join('; ')}.`)
  }

  // Active concerns
  const highTopics = hotTopics.filter(t => t.priority === 'high')
  if (highTopics.length > 0) {
    parts.push(`Key concerns: ${highTopics.map(t => t.text).join('. ')}.`)
  }

  // Bid activity
  const pendingBids = ctx.bids.filter(b => b.status === 'pending')
  const selectedVendors = ctx.bids.filter(b => b.status === 'selected')
  if (pendingBids.length > 0 || selectedVendors.length > 0) {
    const bidParts: string[] = []
    if (selectedVendors.length > 0) bidParts.push(`${selectedVendors.length} vendor${selectedVendors.length > 1 ? 's' : ''} selected`)
    if (pendingBids.length > 0) bidParts.push(`${pendingBids.length} bid${pendingBids.length > 1 ? 's' : ''} pending review`)
    parts.push(bidParts.join(', ') + '.')
  }

  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Main Generator
// ---------------------------------------------------------------------------

/**
 * Generate project status snapshot deterministically from structured data.
 * Drop-in replacement for the AI-powered generateProjectStatusSnapshot().
 */
export function generateProjectStatusFromData(
  ctx: FullProjectContext
): ProjectStatusSnapshot {
  const hot_topics = deriveHotTopics(ctx)
  const action_items = deriveActionItems(ctx)
  const recent_decisions = deriveRecentDecisions(ctx)
  const next_steps = deriveNextSteps(ctx)
  const key_data_points = deriveKeyDataPoints(ctx)

  // Open questions require email NLP — deferred to Claude Code enrichment
  const open_questions: ProjectStatusSnapshot['open_questions'] = []

  const ai_summary = generateTemplateSummary(ctx, hot_topics, recent_decisions)

  return {
    hot_topics,
    action_items,
    recent_decisions,
    next_steps,
    open_questions,
    key_data_points,
    ai_summary,
  }
}
