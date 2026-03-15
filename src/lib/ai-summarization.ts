import { getAnthropicClient, parseAIJsonResponse } from './ai-clients'
import type { Email, Question, KeyDataPoint, Bid, Selection, ConstructionLoan } from '@/types'
import type { BudgetItemRecord } from './budget-service'

const MODEL = 'claude-sonnet-4-6'

export interface KnowledgeStateSummary {
  totalItems: number
  completed: number
  inProgress: number
  blocked: number
  ready: number
  pending: number
  decisionsPending: number
}

export interface FullProjectContext {
  project: {
    name: string
    address: string
    phase: string
    currentStep: number
    totalSteps: number
    startDate: string
    targetCompletion: string
    squareFootage: number | null
    style: string
  }
  budget: {
    total: number
    spent: number
    remaining: number
    items: BudgetItemRecord[]
  }
  planningSteps: Array<{ step_number: number; name: string; status: string; notes: string | null }>
  milestones: Array<{ name: string; description: string | null; target_date: string | null; completed_date: string | null; status: string; notes: string | null }>
  tasks: Array<{ title: string; description: string | null; due_date: string | null; priority: string; status: string; notes: string | null }>
  permits: Array<{ type: string; permit_number: string | null; status: string; application_date: string | null; approval_date: string | null; notes: string | null }>
  contacts: Array<{ name: string; company: string | null; role: string | null; type: string | null }>
  vendors: Array<{ company_name: string; category: string | null; status: string | null }>
  bids: Bid[]
  selections: Selection[]
  communications: Array<{ date: string; type: string | null; subject: string | null; summary: string | null }>
  loan?: ConstructionLoan | null
  knowledgeState?: KnowledgeStateSummary | null
  changeOrders?: Array<{ title: string; reason: string; status: string; cost_impact: number; schedule_impact_days: number | null }>
  drawSchedule?: { total_draws: number; funded_amount: number; pending_amount: number }
  expiringWarranties?: Array<{ vendor: string; category: string; end_date: string }>
  complianceGaps?: { expired: number; expiring_soon: number; unverified: number }
  punchListStats?: { total: number; completionRate: number; bySeverity: Record<string, number> }
}

function buildProjectDataSection(ctx: FullProjectContext): string {
  const sections: string[] = []

  // Project overview
  sections.push(`=== PROJECT ===
Name: ${ctx.project.name}
Address: ${ctx.project.address}
Phase: ${ctx.project.phase}
Progress: Step ${ctx.project.currentStep} of ${ctx.project.totalSteps}
Start Date: ${ctx.project.startDate}
Target Completion: ${ctx.project.targetCompletion}
Square Footage: ${ctx.project.squareFootage ?? 'N/A'}
Style: ${ctx.project.style}`)

  // Budget
  sections.push(`=== BUDGET (${ctx.budget.items.length} line items) ===
Total: $${ctx.budget.total.toLocaleString()}
Spent: $${ctx.budget.spent.toLocaleString()}
Remaining: $${ctx.budget.remaining.toLocaleString()}`)
  if (ctx.budget.items.length > 0) {
    sections.push(ctx.budget.items.map(b =>
      `  - ${b.category}${b.subcategory ? '/' + b.subcategory : ''}: ${b.description} | Est: $${b.estimated_cost ?? 0} | Actual: $${b.actual_cost ?? 0} | ${b.status}`
    ).join('\n'))
  }

  // Construction Loan
  if (ctx.loan) {
    const l = ctx.loan
    sections.push(`=== CONSTRUCTION LOAN ===
Lender: ${l.lender_name}
Loan Type: ${l.loan_type}
Loan Amount: $${l.loan_amount?.toLocaleString() ?? 'TBD'}
Cost of Construction: $${l.cost_of_construction?.toLocaleString() ?? 'TBD'}
Lot Value: $${l.lot_value?.toLocaleString() ?? 'TBD'}
Application Status: ${l.application_status}
Application Date: ${l.application_date ?? 'N/A'}
Loan Officer: ${l.loan_officer_name ?? 'N/A'} ${l.loan_officer_email ? '(' + l.loan_officer_email + ')' : ''}
Loan Contact: ${l.loan_contact_name ?? 'N/A'} ${l.loan_contact_email ? '(' + l.loan_contact_email + ')' : ''}${l.notes ? '\nNotes: ' + l.notes : ''}`)
  }

  // Planning steps
  if (ctx.planningSteps.length > 0) {
    sections.push(`=== PLANNING STEPS ===\n${ctx.planningSteps.map(s =>
      `  Step ${s.step_number}: ${s.name} [${s.status}]${s.notes ? ' — ' + s.notes : ''}`
    ).join('\n')}`)
  }

  // Milestones
  if (ctx.milestones.length > 0) {
    sections.push(`=== MILESTONES (${ctx.milestones.length}) ===\n${ctx.milestones.map(m =>
      `  - ${m.name} [${m.status}] target: ${m.target_date ?? 'TBD'}${m.completed_date ? ' completed: ' + m.completed_date : ''}${m.notes ? ' — ' + m.notes : ''}`
    ).join('\n')}`)
  }

  // Tasks
  if (ctx.tasks.length > 0) {
    sections.push(`=== ACTIVE TASKS (${ctx.tasks.length}) ===\n${ctx.tasks.map(t =>
      `  - [${t.priority}] ${t.title} [${t.status}]${t.due_date ? ' due: ' + t.due_date : ''}${t.notes ? ' — ' + t.notes : ''}`
    ).join('\n')}`)
  }

  // Permits
  if (ctx.permits.length > 0) {
    sections.push(`=== PERMITS (${ctx.permits.length}) ===\n${ctx.permits.map(p =>
      `  - ${p.type}${p.permit_number ? ' #' + p.permit_number : ''} [${p.status}]${p.application_date ? ' applied: ' + p.application_date : ''}${p.approval_date ? ' approved: ' + p.approval_date : ''}`
    ).join('\n')}`)
  }

  // Contacts
  if (ctx.contacts.length > 0) {
    sections.push(`=== CONTACTS (${ctx.contacts.length}) ===\n${ctx.contacts.map(c =>
      `  - ${c.name}${c.company ? ' @ ' + c.company : ''}${c.role ? ' (' + c.role + ')' : ''}${c.type ? ' [' + c.type + ']' : ''}`
    ).join('\n')}`)
  }

  // Vendors
  if (ctx.vendors.length > 0) {
    sections.push(`=== VENDORS (${ctx.vendors.length}) ===\n${ctx.vendors.map(v =>
      `  - ${v.company_name}${v.category ? ' — ' + v.category : ''}${v.status ? ' [' + v.status + ']' : ''}`
    ).join('\n')}`)
  }

  // Bids
  if (ctx.bids.length > 0) {
    sections.push(`=== BIDS (${ctx.bids.length}) ===\n${ctx.bids.map(b =>
      `  - ${b.vendor_name}: ${b.category}${b.subcategory ? '/' + b.subcategory : ''} — $${b.total_amount.toLocaleString()} [${b.status}]${b.description ? ' | ' + b.description : ''}`
    ).join('\n')}`)
  }

  // Selections
  if (ctx.selections.length > 0) {
    sections.push(`=== SELECTIONS (${ctx.selections.length}) ===\n${ctx.selections.map(s =>
      `  - ${s.room}: ${s.product_name}${s.brand ? ' by ' + s.brand : ''} — ${s.category}${s.subcategory ? '/' + s.subcategory : ''} [${s.status}]${s.unit_price ? ' $' + s.unit_price : ''} x${s.quantity}`
    ).join('\n')}`)
  }

  // Communications
  if (ctx.communications.length > 0) {
    sections.push(`=== RECENT COMMUNICATIONS (${ctx.communications.length}) ===\n${ctx.communications.map(c =>
      `  - ${c.date}${c.type ? ' [' + c.type + ']' : ''}: ${c.subject ?? '(no subject)'}${c.summary ? ' — ' + c.summary : ''}`
    ).join('\n')}`)
  }

  // Change Orders
  if (ctx.changeOrders && ctx.changeOrders.length > 0) {
    sections.push(`=== CHANGE ORDERS (${ctx.changeOrders.length}) ===\n${ctx.changeOrders.map(co =>
      `  - ${co.title} [${co.status}] reason: ${co.reason} | cost impact: $${co.cost_impact.toLocaleString()}${co.schedule_impact_days ? ` | schedule: ${co.schedule_impact_days} days` : ''}`
    ).join('\n')}`)
  }

  // Draw Schedule
  if (ctx.drawSchedule) {
    sections.push(`=== DRAW SCHEDULE ===
Total Draws: ${ctx.drawSchedule.total_draws}
Funded: $${ctx.drawSchedule.funded_amount.toLocaleString()}
Pending: $${ctx.drawSchedule.pending_amount.toLocaleString()}`)
  }

  // Expiring Warranties
  if (ctx.expiringWarranties && ctx.expiringWarranties.length > 0) {
    sections.push(`=== EXPIRING WARRANTIES (30-day warning) ===\n${ctx.expiringWarranties.map(w =>
      `  - ${w.vendor}: ${w.category} expires ${w.end_date}`
    ).join('\n')}`)
  }

  // Compliance Gaps
  if (ctx.complianceGaps && (ctx.complianceGaps.expired > 0 || ctx.complianceGaps.unverified > 0)) {
    sections.push(`=== COMPLIANCE GAPS ===
Expired Insurance: ${ctx.complianceGaps.expired}
Expiring Soon: ${ctx.complianceGaps.expiring_soon}
Unverified: ${ctx.complianceGaps.unverified}`)
  }

  // Punch List Stats
  if (ctx.punchListStats && ctx.punchListStats.total > 0) {
    sections.push(`=== PUNCH LIST ===
Total Items: ${ctx.punchListStats.total}
Completion Rate: ${ctx.punchListStats.completionRate}%
By Severity: ${Object.entries(ctx.punchListStats.bySeverity).map(([k, v]) => `${k}: ${v}`).join(', ')}`)
  }

  // Knowledge Graph State
  if (ctx.knowledgeState) {
    const ks = ctx.knowledgeState
    sections.push(`=== CONSTRUCTION KNOWLEDGE STATE ===
Total Items: ${ks.totalItems}
Completed: ${ks.completed}
In Progress: ${ks.inProgress}
Blocked: ${ks.blocked}
Ready to Start: ${ks.ready}
Pending: ${ks.pending}
Decisions Pending: ${ks.decisionsPending}`)
  }

  return sections.join('\n\n')
}

export async function summarizeIndividualEmail(email: Email): Promise<string> {
  const prompt = `Provide a brief 2-3 sentence summary of this construction project email.
Focus on the key points, action items, or decisions mentioned.

From: ${email.from}
Date: ${email.date}
Subject: ${email.subject}
Body: ${email.body}`

  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 200,
      temperature: 0.3,
      system: 'You are a construction project manager assistant. Provide concise, actionable summaries of construction-related emails.',
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') return content.text
    return 'Unable to generate summary'
  } catch (error) {
    console.error('Error summarizing individual email:', error)
    return 'Unable to generate summary'
  }
}

export async function generateDailyProjectSummary(
  projectData: { phase: string; currentStep: number; totalSteps: number; daysElapsed: number; totalDays: number; budgetUsed: number; budgetTotal: number },
  recentEmails: Email[],
  recentActivity: Record<string, unknown>
): Promise<string> {
  const prompt = `Generate a friendly, concise daily project status summary for a homeowner's spouse who wants to stay informed but isn't involved in day-to-day details.

Current Project Status:
- Phase: ${projectData.phase}
- Progress: ${projectData.currentStep} of ${projectData.totalSteps} steps
- Days: ${projectData.daysElapsed} of ${projectData.totalDays}
- Budget: $${projectData.budgetUsed} of $${projectData.budgetTotal}

Recent Emails Summary:
${recentEmails.map(e => `${e.from}: ${e.subject}`).join('\n')}

Recent Activity:
${JSON.stringify(recentActivity, null, 2)}

Write a 2-3 paragraph summary that:
1. Explains the current status in simple terms
2. Highlights any important decisions or changes
3. Notes what's coming up next
4. Maintains a positive but realistic tone`

  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 600,
      temperature: 0.7,
      system: 'You are a friendly project assistant writing daily summaries for family members to stay informed about their home construction project.',
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') return content.text
    return 'Summary generation in progress...'
  } catch (error) {
    console.error('Error generating daily summary:', error)
    return 'Unable to generate summary at this time.'
  }
}

export interface ActionItemSnapshot {
  status: string
  text: string
  action_type?: 'draft_email' | null
  action_context?: {
    to?: string
    to_name?: string
    subject_hint?: string
    context?: string
  }
}

export interface ProjectStatusSnapshot {
  hot_topics: Array<{ priority: string; text: string }>
  action_items: ActionItemSnapshot[]
  recent_decisions: Array<{ decision: string; impact: string }>
  next_steps: string[]
  open_questions: Question[]
  key_data_points: KeyDataPoint[]
  ai_summary: string
}

export async function generateProjectStatusSnapshot(
  emails: Email[],
  projectContext: FullProjectContext,
  previousStatus?: {
    hot_topics: unknown[]
    action_items: unknown[]
    recent_decisions: unknown[]
    ai_summary: string
    date: string
  } | null
): Promise<ProjectStatusSnapshot> {
  const truncatedEmails = emails.slice(0, 20).map(e => ({
    from: e.from,
    date: e.date,
    subject: e.subject,
    body: e.body.substring(0, 500)
  }))

  const previousStatusSection = previousStatus
    ? `PREVIOUS STATUS REPORT (${previousStatus.date}):
Hot Topics: ${JSON.stringify(previousStatus.hot_topics)}
Action Items: ${JSON.stringify(previousStatus.action_items)}
Recent Decisions: ${JSON.stringify(previousStatus.recent_decisions)}
Summary: ${previousStatus.ai_summary}`
    : 'PREVIOUS STATUS REPORT: This is the first report — no previous status exists.'

  const emailSection = truncatedEmails.length > 0
    ? `NEW EMAILS SINCE LAST UPDATE:
${truncatedEmails.map(e => `
From: ${e.from}
Date: ${e.date}
Subject: ${e.subject}
Body: ${e.body}
`).join('\n---\n')}`
    : 'NEW EMAILS SINCE LAST UPDATE: No new emails since last report.'

  const projectDataSection = buildProjectDataSection(projectContext)

  const prompt = `You are updating a running project status report for a home construction project.

=== GROUNDING RULES (MANDATORY) ===
You MUST ONLY reference facts, names, numbers, dates, vendors, materials that appear in the PROJECT DATA below.
Do NOT invent or assume any information not explicitly provided.
If a section is empty, do NOT fabricate entries for it.
Every vendor name, bid amount, contact, task, milestone you mention MUST come from the data below.

${projectDataSection}

${previousStatusSection}

${emailSection}

INSTRUCTIONS:
- KEEP relevant hot topics from the previous report, REMOVE any that are clearly resolved, ADD new ones from emails
- UPDATE action item statuses based on email content, ADD new action items, KEEP unresolved items from previous report
- KEEP all previous decisions, ADD any new decisions found in emails
- REWRITE the summary to incorporate both previous context and new information into a coherent 2-3 paragraph narrative
- Reference actual vendor names, bid amounts, milestones, and budget items from the PROJECT DATA above — do NOT make up names or numbers

Return a JSON object with exactly these keys:
- "hot_topics": array of {"priority": "high"|"medium"|"low", "text": "description"}
- "action_items": array of action item objects. Each has:
  - "status": "pending"|"in-progress"|"completed"
  - "text": description of what needs to be done
  - "action_type": set to "draft_email" if this item requires sending an email (e.g. requesting info, following up, responding to someone). Set to null otherwise.
  - "action_context": only include when action_type is "draft_email". Object with:
    - "to": recipient email address (extract from the emails above)
    - "to_name": recipient name
    - "subject_hint": suggested email subject line
    - "context": brief description of what the email should cover
- "recent_decisions": array of {"decision": "what was decided", "impact": "why it matters"}
- "next_steps": array of strings describing concrete next steps for the project
- "open_questions": array of {"question": "the question", "askedBy": "who asked", "needsResponseFrom": "who needs to answer"} — unanswered questions from emails
- "key_data_points": array of {"category": "topic area", "data": "the data point", "importance": "critical"|"important"|"info"} — important numbers, dates, specs mentioned in emails
- "ai_summary": a 2-3 paragraph narrative summary of current project status

Return valid JSON only, no markdown fences.`

  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.2,
      system: 'You are a construction project manager maintaining a running status report. You MUST only use facts from the provided project data. Do NOT invent vendor names, bid amounts, materials, or any other details. Respond with valid JSON only.',
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = parseAIJsonResponse(content.text) as ProjectStatusSnapshot
      return {
        hot_topics: parsed.hot_topics || [],
        action_items: parsed.action_items || [],
        recent_decisions: parsed.recent_decisions || [],
        next_steps: parsed.next_steps || [],
        open_questions: parsed.open_questions || [],
        key_data_points: parsed.key_data_points || [],
        ai_summary: parsed.ai_summary || 'Summary not available'
      }
    }

    return getEmptySnapshot()
  } catch (error) {
    console.error('Error generating project status snapshot:', error)
    return getEmptySnapshot()
  }
}

function getEmptySnapshot(): ProjectStatusSnapshot {
  return {
    hot_topics: [],
    action_items: [],
    recent_decisions: [],
    next_steps: [],
    open_questions: [],
    key_data_points: [],
    ai_summary: 'Unable to generate project status snapshot at this time.'
  }
}

