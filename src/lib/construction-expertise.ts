/**
 * Construction Domain Expertise — distilled knowledge for AI prompts.
 *
 * This module provides construction-specific context that gets injected into
 * AI system prompts across the app. The knowledge is derived from the owner's
 * engram construction knowledge base (8 files, ~2,500 lines) and distilled
 * into prompt-efficient formats.
 *
 * Three consumers:
 *   1. Assistant system prompt (buildSystemPrompt)
 *   2. Status report generation (generateProjectStatusSnapshot)
 *   3. Email triage/summarization (summarizeIndividualEmail)
 */

// ---------------------------------------------------------------------------
// Phase Sequencing — what the AI needs to understand about construction order
// ---------------------------------------------------------------------------

export const PHASE_SEQUENCE = [
  { phase: 1, name: 'Site Preparation & Clearing', duration: '1-3 wk', criticalPath: true },
  { phase: 2, name: 'Earthwork & Grading', duration: '2-5 wk', criticalPath: true },
  { phase: 3, name: 'Foundation', duration: '3-5 wk', criticalPath: true },
  { phase: 4, name: 'Framing', duration: '6-10 wk', criticalPath: true },
  { phase: 5, name: 'Roofing & Dry-In', duration: '2-4 wk', criticalPath: true },
  { phase: 6, name: 'Windows & Exterior Doors', duration: '1-2 wk', criticalPath: false },
  { phase: 7, name: 'MEP Rough-In', duration: '4-6 wk', criticalPath: true },
  { phase: 8, name: 'Exterior Cladding & Masonry', duration: '4-8 wk', criticalPath: false },
  { phase: 9, name: 'Insulation', duration: '1-2 wk', criticalPath: true },
  { phase: 10, name: 'Drywall', duration: '3-5 wk', criticalPath: true },
  { phase: 11, name: 'Interior Trim & Cabinetry', duration: '3-5 wk', criticalPath: true },
  { phase: 12, name: 'Painting', duration: '2-3 wk', criticalPath: true },
  { phase: 13, name: 'Finish Mechanical & Fixtures', duration: '2-3 wk', criticalPath: true },
  { phase: 14, name: 'Flooring & Countertops', duration: '3-5 wk', criticalPath: true },
  { phase: 15, name: 'Final Site Work & Landscaping', duration: '3-6 wk', criticalPath: false },
  { phase: 16, name: 'Punch List & CO', duration: '2-4 wk', criticalPath: true },
] as const

// ---------------------------------------------------------------------------
// Lead time items that drive selection deadlines
// ---------------------------------------------------------------------------

export const LEAD_TIME_ITEMS = [
  { item: 'Custom windows', weeks: '8-14', orderBy: 'Permit issuance' },
  { item: 'Cabinets (custom painted)', weeks: '8-14', orderBy: 'Rough framing' },
  { item: 'Exterior stone', weeks: '4-8', orderBy: 'Before WRB install' },
  { item: 'Appliances', weeks: '4-8', orderBy: 'Before MEP rough-in' },
  { item: 'Countertops (natural stone)', weeks: '3-5', orderBy: 'After cabinet install' },
  { item: 'Hardwood flooring', weeks: '2-4', orderBy: 'Before painting complete' },
] as const

// Map lead time items to selection categories so we can check what's been selected
const LEAD_TIME_SELECTION_MAP: Record<string, { selectionCategories: string[]; bidCategories: string[] }> = {
  'Custom windows': {
    selectionCategories: ['window', 'windows'],
    bidCategories: ['Windows', 'Windows & Doors'],
  },
  'Cabinets (custom painted)': {
    selectionCategories: ['cabinet', 'cabinetry'],
    bidCategories: ['Cabinets', 'Cabinetry'],
  },
  'Exterior stone': {
    selectionCategories: ['stone', 'masonry'],
    bidCategories: ['Stone', 'Masonry', 'Exterior Stone'],
  },
  'Appliances': {
    selectionCategories: ['appliance'],
    bidCategories: ['Appliances'],
  },
  'Countertops (natural stone)': {
    selectionCategories: ['countertop'],
    bidCategories: ['Countertops'],
  },
  'Hardwood flooring': {
    selectionCategories: ['flooring', 'hardwood'],
    bidCategories: ['Flooring', 'Hardwood'],
  },
}

export interface LeadTimeAlert {
  item: string
  weeks: string
  orderBy: string
  hasSelection: boolean
  hasBid: boolean
  urgency: 'critical' | 'warning' | 'info'
  message: string
}

/**
 * Check which long-lead items are missing selections or bids.
 * Returns alerts sorted by urgency.
 */
export function getLeadTimeAlerts(
  selections: Array<{ category: string; status: string }>,
  bids: Array<{ category: string; status: string }>,
): LeadTimeAlert[] {
  const alerts: LeadTimeAlert[] = []

  for (const lt of LEAD_TIME_ITEMS) {
    const mapping = LEAD_TIME_SELECTION_MAP[lt.item]
    if (!mapping) continue

    const hasSelection = selections.some(s =>
      mapping.selectionCategories.some(cat =>
        s.category.toLowerCase().includes(cat)
      ) && s.status === 'selected'
    )

    const hasBid = bids.some(b =>
      mapping.bidCategories.some(cat =>
        b.category.toLowerCase().includes(cat.toLowerCase())
      ) && (b.status === 'selected' || b.status === 'under_review' || b.status === 'pending')
    )

    if (!hasSelection || !hasBid) {
      const maxWeeks = parseInt(lt.weeks.split('-')[1] || lt.weeks)
      const urgency: LeadTimeAlert['urgency'] = maxWeeks >= 10 ? 'critical' : maxWeeks >= 6 ? 'warning' : 'info'

      let message = ''
      if (!hasSelection && !hasBid) {
        message = `No selection or bids for ${lt.item} — ${lt.weeks} week lead time. Order by: ${lt.orderBy}`
      } else if (!hasSelection) {
        message = `${lt.item}: bids received but no selection made yet — ${lt.weeks} week lead time`
      } else {
        message = `${lt.item}: selected but no bid finalized — ${lt.weeks} week lead time`
      }

      alerts.push({
        item: lt.item,
        weeks: lt.weeks,
        orderBy: lt.orderBy,
        hasSelection,
        hasBid,
        urgency,
        message,
      })
    }
  }

  // Sort: critical first, then warning, then info
  const urgencyOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  return alerts
}

// ---------------------------------------------------------------------------
// Red flags the AI should watch for
// ---------------------------------------------------------------------------

export const RED_FLAGS = {
  schedule: [
    'No written schedule exists or has not been updated in 2+ weeks',
    'Milestones keep moving without documented reason',
    'No subs on site for 3+ consecutive workdays',
    'Critical path tasks showing up late',
    'GC/builder not returning calls or providing vague timeline answers',
  ],
  financial: [
    'Draw requests front-loaded (asking for more money than work completed)',
    'Subs asking to be paid directly (GC may not be paying them)',
    'Change order frequency increasing (>1-2 per month)',
    'Lien waivers not provided with each draw',
    'Bid more than 20% below competitors (they missed something or will change-order)',
  ],
  quality: [
    'Consecutive inspection failures in the same trade',
    'Subs doing rework on completed phases',
    'Materials sitting on site unused for 2+ weeks',
    'Water intrusion before dry-in',
  ],
  communication: [
    'Weekly updates stop coming from GC',
    '"We\'re waiting on..." is the default answer for 3+ weeks',
    'Owner learns about problems from subs, not from GC',
  ],
} as const

// ---------------------------------------------------------------------------
// Texas / Williamson County specifics
// ---------------------------------------------------------------------------

const TX_CLIMATE_CONTEXT = `Central Texas (Williamson County) climate considerations:
- IECC Climate Zone 2-3; hot-humid with expansive clay soils
- Concrete: pour before 10 AM in summer; no pours below 40°F or in rain
- Spray foam: needs 60-80°F ambient; summer attic temps exceed 150°F
- Clay soils swell/shrink with moisture; 2-3 days rain adds a week of drying
- Annual lost weather days: 15-25 (rain + extreme heat + freeze)
- Hail season March-June; sod best spring or fall
- Blower door target: ≤5 ACH50 per IECC, ≤3 ACH50 for quality custom`

// ---------------------------------------------------------------------------
// Project-specific context for Daniel's build
// ---------------------------------------------------------------------------

const PROJECT_CONTEXT = `Project specifics:
- 7,571 sqft French Country custom home, owner-builder via UBuildIt
- ASIRI foundation (rigid inclusions) adds 2-3 weeks vs standard slab
- Stone exterior cladding: plan 6-8 weeks masonry
- Inset maple painted white cabinets (8-14 week lead time)
- Currently in Planning Phase (pre-construction)
- Key roles: Owner (Daniel), UBuildIt Consultant, GC (Wise Contracting)
- Owner retains: budget authority, design decisions, vendor selection, lender relationship
- GC handles: daily site supervision, sub scheduling, code compliance, inspections`

// ---------------------------------------------------------------------------
// Prompt builders — each returns a focused expertise block for injection
// ---------------------------------------------------------------------------

/**
 * Full construction expertise for the assistant system prompt.
 * ~800 tokens — rich enough to be useful, compact enough for every request.
 */
export function getAssistantExpertise(): string {
  return `=== CONSTRUCTION DOMAIN EXPERTISE ===

${PROJECT_CONTEXT}

${TX_CLIMATE_CONTEXT}

CRITICAL PATH (sequential dependencies — delays here delay everything):
${PHASE_SEQUENCE.filter(p => p.criticalPath).map(p => `  Phase ${p.phase}: ${p.name} (${p.duration})`).join('\n')}
Total critical path: 12-18 months for this build.

PARALLEL WORK (has float, can overlap):
- Exterior cladding/masonry runs parallel with MEP rough-in
- Landscaping/site work runs parallel with interior finishes
- Windows install overlaps with roofing/MEP start

LEAD TIME ALERTS — selections must be finalized months before installation:
${LEAD_TIME_ITEMS.map(l => `  ${l.item}: ${l.weeks} weeks, order by ${l.orderBy}`).join('\n')}

RED FLAGS TO WATCH:
- Schedule: no updates 2+ weeks, milestones shifting, no subs on site 3+ days
- Financial: front-loaded draws, missing lien waivers, change orders >1-2/month
- Quality: consecutive inspection failures, rework, water intrusion before dry-in
- Communication: GC radio silence 2+ days, "waiting on..." for 3+ weeks

BID EVALUATION RULES:
- Minimum 3 bids for major trades, 2-3 for specialty
- >20% below competitors = red flag (missed scope or will change-order)
- Never negotiate on material quality, only on margin and efficiency
- Compare total installed cost including delivery and installation
- Require: written scope, timeline, warranty, insurance cert, lien waiver plan

CHANGE ORDER DISCIPLINE:
- "Stop, price, approve" rule: no extra work before written approval
- Track cumulative CO cost; alarm at 5% of total budget
- Code-required changes are non-negotiable; aesthetic upgrades can wait

OWNER-BUILDER RISKS: delayed selections (#1 owner-caused delay), decision fatigue,
sub leverage (they may deprioritize your job), warranty gaps (each sub warrants own work).`
}

/**
 * Focused expertise for status report generation.
 * Tells the AI what to look for in emails and project data.
 */
export function getStatusReportExpertise(): string {
  return `=== CONSTRUCTION ANALYSIS EXPERTISE ===

You are analyzing a 7,571 sqft custom home build in Central Texas (owner-builder via UBuildIt).

WHEN ANALYZING EMAILS, watch for these construction-specific signals:
1. CRITICAL PATH IMPACT: Anything affecting foundation→framing→MEP→insulation→drywall→finishes sequence
2. SELECTION DEADLINES: Windows (8-14 wk lead), cabinets (8-14 wk), stone (4-8 wk), appliances (4-8 wk)
3. UNRESPONSIVE SUBS: If a vendor/engineer hasn't responded in 2+ weeks, flag as high-priority blocker
4. INSPECTION RESULTS: Pass/fail affects all downstream work
5. WEATHER DELAYS: Central TX clay soil + rain = multi-day delays for earthwork/foundation
6. BUDGET SIGNALS: Change orders, price increases, draw requests, lien waiver mentions
7. LOAN STATUS: Any communication from lender about approval, conditions, closing dates

PRIORITY CLASSIFICATION for hot topics:
- HIGH: Anything on the critical path, unresponsive subs blocking work, inspection failures, budget overruns >5%
- MEDIUM: Selection deadlines approaching, vendor follow-ups needed, permit status changes
- LOW: Routine updates, FYI communications, future planning items

ACTION ITEM CLASSIFICATION:
- "draft_email" type: When an email needs a response, follow-up, or request for information
- Include email context: who to email, what to ask, why it's important

CHANGE ORDER AWARENESS:
- Flag any scope change or cost increase mentioned in emails
- Track cumulative CO impact against budget
- Distinguish code-required changes (non-negotiable) from aesthetic upgrades (can defer)`
}

/**
 * Focused expertise for email summarization and triage.
 * Tells the AI how to assess urgency in a construction context.
 */
export function getEmailTriageExpertise(): string {
  return `You are a construction project manager summarizing emails for a 7,571 sqft custom home build (owner-builder, Central Texas).

URGENCY ASSESSMENT — classify based on construction impact:
- CRITICAL PATH emails (structural engineer, foundation contractor, framing crew, MEP subs, inspectors) are inherently higher priority
- LENDER emails about loan status, conditions, or closing are always high priority
- VENDOR responses to bid requests or scope questions are time-sensitive
- Unresponsive sub follow-ups (especially if blocking other work) are urgent
- Selection/material confirmations are priority when lead times are involved

WHEN SUMMARIZING, focus on:
1. Decisions made or needed (with deadlines if mentioned)
2. Cost/price information (exact amounts)
3. Timeline/schedule impacts (dates, lead times, delays)
4. Action items with clear owners
5. Red flags: scope changes, price increases, delays, unresponsiveness

CONSTRUCTION-SPECIFIC PATTERNS TO RECOGNIZE:
- Bid/quote/proposal/estimate = money decision needed
- "Revised"/"updated"/"change" in subject = scope change, compare to original
- Engineer/architect communication = may affect structural plans
- Inspector/permit = regulatory gate, may block progress
- "Lien waiver"/"retainage"/"draw" = financial/legal significance`
}
