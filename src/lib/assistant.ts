/**
 * Project Assistant — tool definitions, system prompt, and read tool executor.
 *
 * Read tools  (7) — auto-executed server-side, results fed back to Claude.
 * Write tools (7) — returned to the client as PendingAction for user confirmation.
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { PendingAction, WriteToolName } from '@/types'
import { getProject, getBudgetSummary } from './project-service'
import { getBids } from './bids-service'
import { getBudgetItems } from './budget-service'
import { getSelections } from './selections-service'
import { db } from './database'
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Tool name sets
// ---------------------------------------------------------------------------

export const READ_TOOL_NAMES = new Set([
  'get_project_overview',
  'search_bids',
  'get_budget_items',
  'get_selections',
  'search_emails',
  'get_contacts',
  'get_planning_steps',
  'get_status_history',
] as const)

export const WRITE_TOOL_NAMES = new Set([
  'update_bid',
  'add_bid',
  'update_selection',
  'add_selection',
  'update_budget_item',
  'add_budget_item',
  'update_milestone',
] as const)

export function isReadTool(name: string): boolean {
  return READ_TOOL_NAMES.has(name as never)
}

export function isWriteTool(name: string): boolean {
  return WRITE_TOOL_NAMES.has(name as never)
}

// ---------------------------------------------------------------------------
// Friendly labels for tool_status events
// ---------------------------------------------------------------------------

const TOOL_STATUS_LABELS: Record<string, string> = {
  get_project_overview: 'Loading project overview…',
  search_bids: 'Searching bids…',
  get_budget_items: 'Loading budget items…',
  get_selections: 'Loading selections…',
  search_emails: 'Searching emails…',
  get_contacts: 'Loading contacts…',
  get_planning_steps: 'Loading planning steps…',
  get_status_history: 'Loading status history…',
}

export function getToolStatusLabel(name: string): string {
  return TOOL_STATUS_LABELS[name] || `Running ${name}…`
}

// ---------------------------------------------------------------------------
// READ TOOLS — definitions for Anthropic API
// ---------------------------------------------------------------------------

const READ_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_project_overview',
    description:
      'Get a high-level overview of the project: address, phase, budget summary, planning step progress, latest status report, and upcoming milestone.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_bids',
    description:
      'Search vendor bids. Filter by vendor name, category (e.g. "Windows", "Stone", "Roofing"), or status (pending, under_review, selected, rejected, expired). Returns matching bids with amounts, vendor info, and notes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        vendor_name: {
          type: 'string',
          description: 'Filter by vendor name (case-insensitive partial match)',
        },
        category: {
          type: 'string',
          description: 'Filter by bid category (case-insensitive partial match)',
        },
        status: {
          type: 'string',
          enum: ['pending', 'under_review', 'selected', 'rejected', 'expired'],
          description: 'Filter by bid status',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_budget_items',
    description:
      'Get budget line items. Optionally filter by category. Shows estimated vs actual costs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Filter by budget category (case-insensitive partial match)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_selections',
    description:
      'Get product selections (fixtures, finishes, appliances). Filter by room, category, or status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        room: {
          type: 'string',
          description: 'Filter by room name (case-insensitive partial match)',
        },
        category: {
          type: 'string',
          description: 'Filter by selection category (case-insensitive partial match)',
        },
        status: {
          type: 'string',
          enum: ['considering', 'selected', 'ordered', 'received', 'installed', 'alternative'],
          description: 'Filter by selection status',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_emails',
    description:
      'Search recent project emails. Filter by keyword query (matches subject, sender, or AI summary). Specify days to look back and result limit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search term to match against subject, sender email/name, or AI summary',
        },
        days: {
          type: 'number',
          description: 'Number of days to look back (default 14)',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_contacts',
    description:
      'Get all project contacts: vendors, consultants, contractors with names, roles, emails, and phone numbers.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_planning_steps',
    description:
      'Get the 6 planning phase steps with their current status (pending, in_progress, completed).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_status_history',
    description:
      'Get recent project status snapshots (up to 7). Each snapshot includes hot topics, action items, decisions, next steps, open questions, key data points, and AI summary. Use this to answer questions about what changed over time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent snapshots to return (default 7, max 14)',
        },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// WRITE TOOLS — definitions for Anthropic API
// ---------------------------------------------------------------------------

const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'update_bid',
    description:
      'Update an existing bid. Requires the bid ID. Can change status, amount, notes, pros/cons, or selection_notes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        bid_id: { type: 'string', description: 'The bid UUID to update' },
        status: {
          type: 'string',
          enum: ['pending', 'under_review', 'selected', 'rejected', 'expired'],
        },
        total_amount: { type: 'number', description: 'Updated total amount' },
        internal_notes: { type: 'string' },
        pros: { type: 'string' },
        cons: { type: 'string' },
        selection_notes: { type: 'string' },
      },
      required: ['bid_id'],
    },
  },
  {
    name: 'add_bid',
    description:
      'Add a new vendor bid. Requires vendor name, category, description, and total amount.',
    input_schema: {
      type: 'object' as const,
      properties: {
        vendor_name: { type: 'string', description: 'Vendor/company name' },
        vendor_email: { type: 'string' },
        vendor_phone: { type: 'string' },
        category: { type: 'string', description: 'Bid category (e.g. Windows, Stone, Roofing)' },
        subcategory: { type: 'string' },
        description: { type: 'string', description: 'Brief description of the bid' },
        total_amount: { type: 'number', description: 'Total bid amount in dollars' },
        scope_of_work: { type: 'string' },
        inclusions: {
          type: 'array',
          items: { type: 'string' },
          description: 'What is included',
        },
        exclusions: {
          type: 'array',
          items: { type: 'string' },
          description: 'What is excluded',
        },
        lead_time_weeks: { type: 'number' },
        internal_notes: { type: 'string' },
      },
      required: ['vendor_name', 'category', 'description', 'total_amount'],
    },
  },
  {
    name: 'update_selection',
    description:
      'Update an existing product selection. Requires the selection ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selection_id: { type: 'string', description: 'The selection UUID to update' },
        status: {
          type: 'string',
          enum: ['considering', 'selected', 'ordered', 'received', 'installed', 'alternative'],
        },
        unit_price: { type: 'number' },
        total_price: { type: 'number' },
        notes: { type: 'string' },
        lead_time: { type: 'string' },
        order_date: { type: 'string', description: 'ISO date string' },
        product_url: { type: 'string' },
      },
      required: ['selection_id'],
    },
  },
  {
    name: 'add_selection',
    description:
      'Add a new product selection. Requires room, category, product name, and quantity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        room: { type: 'string', description: 'Room name (e.g. Kitchen, Master Bath)' },
        category: { type: 'string', description: 'Category (e.g. plumbing, lighting, appliance)' },
        subcategory: { type: 'string' },
        product_name: { type: 'string' },
        brand: { type: 'string' },
        model_number: { type: 'string' },
        finish: { type: 'string' },
        color: { type: 'string' },
        quantity: { type: 'number', description: 'Quantity needed (default 1)' },
        unit_price: { type: 'number' },
        total_price: { type: 'number' },
        status: {
          type: 'string',
          enum: ['considering', 'selected', 'ordered', 'received', 'installed', 'alternative'],
        },
        notes: { type: 'string' },
        product_url: { type: 'string' },
      },
      required: ['room', 'category', 'product_name', 'quantity'],
    },
  },
  {
    name: 'update_budget_item',
    description:
      'Update an existing budget line item. Requires the budget item ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        budget_item_id: { type: 'string', description: 'The budget item UUID to update' },
        actual_cost: { type: 'number', description: 'Actual cost in dollars' },
        estimated_cost: { type: 'number', description: 'Estimated cost in dollars' },
        status: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['budget_item_id'],
    },
  },
  {
    name: 'add_budget_item',
    description:
      'Add a new budget line item. Requires category, description, and estimated cost.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Budget category' },
        subcategory: { type: 'string' },
        description: { type: 'string' },
        estimated_cost: { type: 'number', description: 'Estimated cost in dollars' },
        actual_cost: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['category', 'description', 'estimated_cost'],
    },
  },
  {
    name: 'update_milestone',
    description:
      'Update a construction milestone status or target date. Requires the milestone ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        milestone_id: { type: 'string', description: 'The milestone UUID to update' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'delayed'],
        },
        target_date: { type: 'string', description: 'ISO date string' },
        notes: { type: 'string' },
      },
      required: ['milestone_id'],
    },
  },
]

// ---------------------------------------------------------------------------
// Combined tool list
// ---------------------------------------------------------------------------

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [...READ_TOOLS, ...WRITE_TOOLS]

// ---------------------------------------------------------------------------
// buildSystemPrompt — lightweight (~250 tokens)
// ---------------------------------------------------------------------------

export async function buildSystemPrompt(projectId: string): Promise<string> {
  const [project, budget] = await Promise.all([
    getProject(),
    getBudgetSummary(projectId),
  ])

  const budgetTotal = budget.total || parseFloat(project?.budget_total || '450000')
  const budgetSpent = budget.spent || 0

  return `You are the Project Assistant for a home construction project.
TODAY: ${new Date().toISOString().split('T')[0]}
PROJECT: ${project?.address || 'Not set'} | Phase: ${project?.phase || 'planning'} | Budget: $${budgetTotal.toLocaleString()} ($${budgetSpent.toLocaleString()} spent)

Use READ tools to look up data before answering questions. Use WRITE tools to propose changes (user must confirm).
Be specific with amounts, dates, and names. Call multiple tools if needed to give a complete answer.
When comparing bids or selections, present data in a clear format with key differences highlighted.`
}

// ---------------------------------------------------------------------------
// executeReadTool — server-side execution, returns JSON string
// ---------------------------------------------------------------------------

export async function executeReadTool(
  toolName: string,
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  switch (toolName) {
    case 'get_project_overview':
      return getProjectOverview(projectId)
    case 'search_bids':
      return searchBidsForTool(input, projectId)
    case 'get_budget_items':
      return getBudgetItemsForTool(input, projectId)
    case 'get_selections':
      return getSelectionsForTool(input, projectId)
    case 'search_emails':
      return searchEmailsForTool(input)
    case 'get_contacts':
      return getContactsForTool(projectId)
    case 'get_planning_steps':
      return getPlanningStepsForTool(projectId)
    case 'get_status_history':
      return getStatusHistoryForTool(input, projectId)
    default:
      return JSON.stringify({ error: `Unknown read tool: ${toolName}` })
  }
}

// ---------------------------------------------------------------------------
// Read tool handlers
// ---------------------------------------------------------------------------

async function getProjectOverview(projectId: string): Promise<string> {
  const [project, budget, planningSteps, latestStatus] = await Promise.all([
    getProject(),
    getBudgetSummary(projectId),
    supabase
      .from('planning_phase_steps')
      .select('step_number, name, status')
      .eq('project_id', projectId)
      .order('step_number', { ascending: true })
      .then(r => r.data || []),
    db.getLatestProjectStatus(projectId),
  ])

  return JSON.stringify({
    project: {
      address: project?.address,
      phase: project?.phase,
      created_at: project?.created_at,
    },
    budget: {
      total: budget.total,
      spent: budget.spent,
      remaining: budget.total - budget.spent,
    },
    planning_steps: planningSteps.map(s => ({
      step: s.step_number,
      name: s.name,
      status: s.status,
    })),
    latest_status: latestStatus
      ? {
          date: latestStatus.date,
          summary: latestStatus.ai_summary,
          hot_topics: latestStatus.hot_topics,
          action_items: latestStatus.action_items,
          recent_decisions: latestStatus.recent_decisions,
          next_steps: latestStatus.next_steps,
          open_questions: latestStatus.open_questions,
          key_data_points: latestStatus.key_data_points,
        }
      : null,
  })
}

async function searchBidsForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const allBids = await getBids(projectId)
  let filtered = allBids

  const vendorName = input.vendor_name as string | undefined
  const category = input.category as string | undefined
  const status = input.status as string | undefined

  if (vendorName) {
    const q = vendorName.toLowerCase()
    filtered = filtered.filter(b => b.vendor_name.toLowerCase().includes(q))
  }
  if (category) {
    const q = category.toLowerCase()
    filtered = filtered.filter(b => b.category.toLowerCase().includes(q))
  }
  if (status) {
    filtered = filtered.filter(b => b.status === status)
  }

  return JSON.stringify({
    count: filtered.length,
    bids: filtered.map(b => ({
      id: b.id,
      vendor_name: b.vendor_name,
      vendor_email: b.vendor_email,
      vendor_phone: b.vendor_phone,
      category: b.category,
      subcategory: b.subcategory,
      description: b.description,
      total_amount: b.total_amount,
      status: b.status,
      bid_date: b.bid_date,
      lead_time_weeks: b.lead_time_weeks,
      scope_of_work: b.scope_of_work,
      inclusions: b.inclusions,
      exclusions: b.exclusions,
      pros: b.pros,
      cons: b.cons,
      internal_notes: b.internal_notes,
      selection_notes: b.selection_notes,
    })),
  })
}

async function getBudgetItemsForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const items = await getBudgetItems(projectId)
  let filtered = items

  const category = input.category as string | undefined
  if (category) {
    const q = category.toLowerCase()
    filtered = filtered.filter(i => i.category.toLowerCase().includes(q))
  }

  const totalEstimated = filtered.reduce((s, i) => s + (i.estimated_cost || 0), 0)
  const totalActual = filtered.reduce((s, i) => s + (i.actual_cost || 0), 0)

  return JSON.stringify({
    count: filtered.length,
    total_estimated: totalEstimated,
    total_actual: totalActual,
    items: filtered.map(i => ({
      id: i.id,
      category: i.category,
      subcategory: i.subcategory,
      description: i.description,
      estimated_cost: i.estimated_cost,
      actual_cost: i.actual_cost,
      status: i.status,
      notes: i.notes,
    })),
  })
}

async function getSelectionsForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const all = await getSelections(projectId)
  let filtered = all

  const room = input.room as string | undefined
  const category = input.category as string | undefined
  const status = input.status as string | undefined

  if (room) {
    const q = room.toLowerCase()
    filtered = filtered.filter(s => s.room.toLowerCase().includes(q))
  }
  if (category) {
    const q = category.toLowerCase()
    filtered = filtered.filter(s => s.category.toLowerCase().includes(q))
  }
  if (status) {
    filtered = filtered.filter(s => s.status === status)
  }

  return JSON.stringify({
    count: filtered.length,
    selections: filtered.map(s => ({
      id: s.id,
      room: s.room,
      category: s.category,
      subcategory: s.subcategory,
      product_name: s.product_name,
      brand: s.brand,
      model_number: s.model_number,
      finish: s.finish,
      color: s.color,
      quantity: s.quantity,
      unit_price: s.unit_price,
      total_price: s.total_price,
      status: s.status,
      lead_time: s.lead_time,
      notes: s.notes,
      product_url: s.product_url,
    })),
  })
}

async function searchEmailsForTool(input: Record<string, unknown>): Promise<string> {
  const days = (input.days as number) || 14
  const limit = (input.limit as number) || 20
  const query = (input.query as string) || ''

  const emails = await db.getRecentEmails(days)
  let filtered = emails

  if (query) {
    const q = query.toLowerCase()
    filtered = filtered.filter(
      e =>
        e.subject.toLowerCase().includes(q) ||
        e.sender_email.toLowerCase().includes(q) ||
        (e.sender_name || '').toLowerCase().includes(q) ||
        (e.ai_summary || '').toLowerCase().includes(q)
    )
  }

  filtered = filtered.slice(0, limit)

  return JSON.stringify({
    count: filtered.length,
    emails: filtered.map(e => ({
      id: e.id,
      subject: e.subject,
      sender_email: e.sender_email,
      sender_name: e.sender_name,
      received_date: e.received_date,
      ai_summary: e.ai_summary,
      is_read: e.is_read,
      category: e.category,
      urgency_level: e.urgency_level,
    })),
  })
}

async function getContactsForTool(projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, role, email, phone, company, notes')
    .eq('project_id', projectId)
    .order('name', { ascending: true })

  if (error) {
    return JSON.stringify({ error: 'Failed to fetch contacts', count: 0, contacts: [] })
  }

  return JSON.stringify({ count: (data || []).length, contacts: data || [] })
}

async function getPlanningStepsForTool(projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('planning_phase_steps')
    .select('step_number, name, status, notes, updated_at')
    .eq('project_id', projectId)
    .order('step_number', { ascending: true })

  if (error) {
    return JSON.stringify({ error: 'Failed to fetch planning steps', steps: [] })
  }

  return JSON.stringify({
    steps: (data || []).map(s => ({
      step: s.step_number,
      name: s.name,
      status: s.status,
      notes: s.notes,
      updated_at: s.updated_at,
    })),
  })
}

async function getStatusHistoryForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const limit = Math.min((input.limit as number) || 7, 14)
  const history = await db.getProjectStatusHistory(projectId, limit)

  return JSON.stringify({
    count: history.length,
    snapshots: history.map(s => ({
      date: s.date,
      ai_summary: s.ai_summary,
      hot_topics: s.hot_topics,
      action_items: s.action_items,
      recent_decisions: s.recent_decisions,
      next_steps: s.next_steps,
      open_questions: s.open_questions,
      key_data_points: s.key_data_points,
    })),
  })
}

// ---------------------------------------------------------------------------
// parseToolCall — convert a write tool_use into a PendingAction
// ---------------------------------------------------------------------------

export function parseToolCall(
  toolName: string,
  input: Record<string, unknown>,
  toolUseId: string
): PendingAction {
  const descriptions: Record<string, (i: Record<string, unknown>) => string> = {
    update_bid: i => `Update bid ${i.bid_id}${i.status ? ` → ${i.status}` : ''}${i.total_amount ? ` ($${Number(i.total_amount).toLocaleString()})` : ''}`,
    add_bid: i => `Add bid: ${i.vendor_name} — ${i.category} ($${Number(i.total_amount).toLocaleString()})`,
    update_selection: i => `Update selection ${i.selection_id}${i.status ? ` → ${i.status}` : ''}`,
    add_selection: i => `Add selection: ${i.product_name} in ${i.room}`,
    update_budget_item: i => `Update budget item ${i.budget_item_id}`,
    add_budget_item: i => `Add budget item: ${i.category} — ${i.description} ($${Number(i.estimated_cost).toLocaleString()})`,
    update_milestone: i => `Update milestone ${i.milestone_id}${i.status ? ` → ${i.status}` : ''}`,
  }

  const descFn = descriptions[toolName]
  const description = descFn ? descFn(input) : `${toolName}: ${JSON.stringify(input)}`

  return {
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tool_use_id: toolUseId,
    type: toolName as WriteToolName,
    description,
    data: input,
  }
}
