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
import {
  getKnowledgeTree,
  getBlockers,
  getCascadingRequirements,
  getKnowledgeStateSummary,
} from './knowledge-graph'
import {
  getWorkflowOverview,
  getWorkflowAlerts,
} from './workflow-service'
import {
  research as executeResearch,
} from './research-service'
import type { ResearchType } from './research-service'
import {
  getExtractions,
  getRoomSchedule,
  getFixtureSummary,
} from './plan-takeoff-service'
import { getAssistantExpertise } from './construction-expertise'
import type { ExtractionType } from './plan-takeoff-service'
import {
  getVendorThreads,
  getFollowUpsNeeded,
} from './vendor-thread-service'
import { getChangeOrders, getChangeOrderSummary } from './change-order-service'
import { getDrawSchedule, getDrawSummary } from './draw-schedule-service'
import { getWarranties, getExpiringWarranties, getComplianceGaps } from './warranty-service'
import { getPunchList, getPunchListStats, getInspections } from './punch-list-service'
import type { PunchSeverity, PunchStatus, InspectionStatus } from './punch-list-service'

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
  'get_knowledge_tree',
  'get_blockers',
  'get_cascade_requirements',
  'get_workflow_status',
  'get_workflow_alerts',
  'research_topic',
  'get_plan_extractions',
  'get_vendor_threads',
  'get_follow_ups',
  'get_change_orders',
  'get_draw_schedule',
  'get_warranties',
  'get_punch_list',
  'get_inspections',
] as const)

export const WRITE_TOOL_NAMES = new Set([
  'update_bid',
  'add_bid',
  'update_selection',
  'add_selection',
  'update_budget_item',
  'add_budget_item',
  'update_milestone',
  'update_task',
  'complete_workflow_item',
  'link_selection_to_decision',
  'create_change_order',
  'add_punch_item',
  'schedule_inspection',
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
  get_knowledge_tree: 'Loading construction knowledge…',
  get_blockers: 'Checking blockers…',
  get_cascade_requirements: 'Analyzing requirements cascade…',
  get_workflow_status: 'Loading workflow status…',
  get_workflow_alerts: 'Checking workflow alerts…',
  research_topic: 'Researching…',
  get_plan_extractions: 'Loading plan extractions…',
  get_vendor_threads: 'Loading vendor threads…',
  get_follow_ups: 'Checking follow-ups needed…',
  get_change_orders: 'Loading change orders…',
  get_draw_schedule: 'Loading draw schedule…',
  get_warranties: 'Loading warranties…',
  get_punch_list: 'Loading punch list…',
  get_inspections: 'Loading inspections…',
  link_selection_to_decision: 'Linking selection to decision…',
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
  {
    name: 'get_knowledge_tree',
    description:
      'Get the construction knowledge graph — every step, material, inspection, and decision point in building a home, organized by phase and trade. Optionally filter by phase number or trade name. Includes project-specific status for each item.',
    input_schema: {
      type: 'object' as const,
      properties: {
        phase_number: {
          type: 'number',
          description: 'Filter by construction phase (1-8)',
        },
        trade: {
          type: 'string',
          description: 'Filter by trade name (e.g. "Electrical", "Plumbing Rough", "Roofing")',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_blockers',
    description:
      'Get items currently blocking construction progress — items with status "blocked" and their unmet dependencies. Also returns items that are "ready" to start (all dependencies completed). Use this to answer "what\'s blocking me?" or "what can I start next?".',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_cascade_requirements',
    description:
      'Get the full chain of prerequisites, downstream tasks, materials, and inspections needed for a specific construction item. E.g., asking about "lighting fixtures" returns: junction boxes, wiring, rough-in inspection, fixture install, final inspection, and all materials needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        item_id: {
          type: 'string',
          description: 'The knowledge item UUID to get cascade for',
        },
      },
      required: ['item_id'],
    },
  },
  {
    name: 'get_workflow_status',
    description:
      'Get the guided workflow status: which construction phases are active, completed, or blocked. Shows progress per phase, items ready to start, and overall build completion percentage.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_workflow_alerts',
    description:
      'Get proactive workflow alerts: blocked items, pending decisions that need attention, and items ready to start. Use this to answer "what should I do next?" or "what decisions am I behind on?".',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'research_topic',
    description:
      'Research a construction topic using AI-powered web search. Use for vendor research, material options and pricing, building code requirements, or general construction questions. Results are cached for 7 days. Returns analysis, sources, findings, and recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The research question (e.g., "best insulation for Central Texas climate", "concrete contractors near Liberty Hill TX")',
        },
        type: {
          type: 'string',
          enum: ['vendor', 'material', 'pricing', 'code', 'general'],
          description: 'Type of research: vendor (find contractors), material (product options), pricing (cost data), code (building codes), general',
        },
        knowledge_id: {
          type: 'string',
          description: 'Optional knowledge item UUID to associate research with a specific construction decision point',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_plan_extractions',
    description:
      'Get data extracted from uploaded architectural plans: room schedules, fixture counts, window/door schedules, material takeoffs. Optionally filter by extraction type.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['room_schedule', 'fixture_count', 'window_schedule', 'door_schedule', 'material_takeoff', 'electrical_schedule', 'plumbing_schedule'],
          description: 'Filter by extraction type',
        },
        view: {
          type: 'string',
          enum: ['rooms', 'fixtures'],
          description: 'Use "rooms" for room schedule with finishes, "fixtures" for fixture summary with counts',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_vendor_threads',
    description:
      'Get vendor communication threads: conversation history with each vendor, bid request/response status, days since last contact, follow-up dates. Filter by status or category.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'waiting_response', 'follow_up_needed', 'closed'],
          description: 'Filter by thread status',
        },
        category: {
          type: 'string',
          description: 'Filter by trade/bid category',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_follow_ups',
    description:
      'Get vendor follow-ups needed: vendors who haven\'t responded in X days, overdue bid requests, passed follow-up dates. Shows who needs attention and why.',
    input_schema: {
      type: 'object' as const,
      properties: {
        threshold_days: {
          type: 'number',
          description: 'Number of days before a thread is considered needing follow-up (default 5)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_change_orders',
    description:
      'Get change orders: scope/cost changes during construction. Shows CO number, title, reason, cost impact, schedule impact, and approval status. Includes summary totals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'submitted', 'approved', 'rejected', 'completed'],
        },
      },
      required: [],
    },
  },
  {
    name: 'get_draw_schedule',
    description:
      'Get construction loan draw schedule: disbursement amounts tied to milestone completion, inspection/approval status, funded amounts. Shows what\'s been drawn and what\'s pending.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_warranties',
    description:
      'Get warranty tracking: active/expiring warranties on materials and workmanship, plus subcontractor insurance compliance status. Flags expiring certificates and compliance gaps.',
    input_schema: {
      type: 'object' as const,
      properties: {
        view: {
          type: 'string',
          enum: ['all', 'expiring', 'compliance_gaps'],
          description: 'Use "expiring" for 30-day warnings, "compliance_gaps" for insurance issues',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_punch_list',
    description:
      'Get punch list items: construction deficiencies that need correction. Filter by room, severity (cosmetic/functional/safety/structural), or status. Includes stats with completion rate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        room: { type: 'string', description: 'Filter by room name' },
        severity: { type: 'string', enum: ['cosmetic', 'functional', 'safety', 'structural'] },
        status: { type: 'string', enum: ['identified', 'assigned', 'in_progress', 'completed', 'verified'] },
        view: { type: 'string', enum: ['items', 'stats'], description: 'Use "stats" for summary counts' },
      },
      required: [],
    },
  },
  {
    name: 'get_inspections',
    description:
      'Get construction inspections: scheduled, passed, failed, or conditional. Shows inspector name, deficiencies found, and linked photos.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['not_scheduled', 'scheduled', 'passed', 'failed', 'conditional'] },
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
      'Add a new product selection. Requires room, category, product name, and quantity. Auto-resolves knowledge_id and needed_by_phase from category mapping if not provided.',
    input_schema: {
      type: 'object' as const,
      properties: {
        room: { type: 'string', description: 'Room name (e.g. Kitchen, Master Bath)' },
        category: { type: 'string', description: 'Category (e.g. plumbing, lighting, appliance, countertop, flooring, cabinetry, windows)' },
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
        lead_time: { type: 'string', description: 'Lead time string (e.g. "6-8 weeks")' },
        knowledge_id: { type: 'string', description: 'Knowledge graph decision point to link to (auto-resolved if not provided)' },
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
  {
    name: 'update_task',
    description:
      'Update a task status, due date, or add a resolution note. Requires the task ID. Use this to mark tasks as completed, in_progress, or to add follow-up notes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'The task UUID to update' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'deferred'],
          description: 'New task status',
        },
        due_date: { type: 'string', description: 'Updated due date (ISO date)' },
        resolution_note: { type: 'string', description: 'Note explaining what was done or why deferred — appended to existing notes with timestamp' },
        title: { type: 'string', description: 'Updated task title' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'complete_workflow_item',
    description:
      'Mark a construction workflow item as completed. Requires the knowledge item ID. Optionally include completion date, actual cost, and notes. This automatically unlocks downstream items that depended on it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        knowledge_id: { type: 'string', description: 'The knowledge item UUID to complete' },
        completed_date: { type: 'string', description: 'Completion date (ISO date, defaults to today)' },
        actual_cost: { type: 'number', description: 'Actual cost in dollars (optional)' },
        notes: { type: 'string', description: 'Completion notes' },
      },
      required: ['knowledge_id'],
    },
  },
  {
    name: 'link_selection_to_decision',
    description:
      'Link a product selection to a knowledge graph decision point. Optionally confirm the selection (set status to "selected") and auto-complete the decision if all selections in that category are confirmed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        selection_id: { type: 'string', description: 'The selection UUID to link' },
        knowledge_id: { type: 'string', description: 'The knowledge item UUID (decision point) to link to' },
        confirm: { type: 'boolean', description: 'If true, also set selection status to "selected" and check for auto-completion' },
      },
      required: ['selection_id', 'knowledge_id'],
    },
  },
  {
    name: 'create_change_order',
    description:
      'Create a change order for a scope, cost, or schedule change. Requires title and reason. Tracks cost impact and schedule impact.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Change order title' },
        description: { type: 'string', description: 'Detailed description of the change' },
        category: { type: 'string', description: 'Trade or category affected' },
        reason: {
          type: 'string',
          enum: ['owner_request', 'field_condition', 'code_requirement', 'design_change', 'value_engineering'],
        },
        cost_impact: { type: 'number', description: 'Cost change in dollars (positive=increase, negative=savings)' },
        schedule_impact_days: { type: 'number', description: 'Schedule change in days (positive=delay)' },
        notes: { type: 'string' },
      },
      required: ['title', 'reason'],
    },
  },
  {
    name: 'add_punch_item',
    description:
      'Add a punch list item — a construction deficiency that needs correction. Requires description. Optionally specify room, severity, category, and assigned vendor.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string', description: 'What needs to be fixed' },
        room: { type: 'string', description: 'Room where the issue is' },
        severity: { type: 'string', enum: ['cosmetic', 'functional', 'safety', 'structural'] },
        category: { type: 'string', description: 'Trade category (e.g., Painting, Drywall)' },
        assigned_vendor_name: { type: 'string', description: 'Vendor responsible for the fix' },
        notes: { type: 'string' },
      },
      required: ['description'],
    },
  },
  {
    name: 'schedule_inspection',
    description:
      'Schedule a construction inspection. Requires inspection type (e.g., "Foundation pre-pour", "Framing", "Final electrical"). Optionally set date and inspector.',
    input_schema: {
      type: 'object' as const,
      properties: {
        inspection_type: { type: 'string', description: 'Type of inspection' },
        scheduled_date: { type: 'string', description: 'Inspection date (ISO date)' },
        knowledge_id: { type: 'string', description: 'Related knowledge item ID' },
        permit_id: { type: 'string', description: 'Related permit ID' },
        inspector_name: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['inspection_type'],
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

  const expertise = getAssistantExpertise()

  return `You are the Project Assistant for a custom home construction project. You have deep construction expertise and think like a master builder.
TODAY: ${new Date().toISOString().split('T')[0]}
PROJECT: ${project?.address || 'Not set'} | Phase: ${project?.phase || 'planning'} | Budget: $${budgetTotal.toLocaleString()} ($${budgetSpent.toLocaleString()} spent)

${expertise}

INSTRUCTIONS:
- Use READ tools to look up data before answering. Use WRITE tools to propose changes (user must confirm).
- Be specific with amounts, dates, and names. Call multiple tools if needed.
- When comparing bids, use the bid evaluation rules above. Flag red flags.
- When discussing schedule, reference the critical path and parallel work opportunities.
- When a vendor is unresponsive, recommend the escalation protocol (text→email→escalation→replace).
- When discussing selections, flag lead time risks and order-by deadlines.
- Think about trade intersections — 80% of construction failures happen where trades meet.
- Apply the rule: Structure > Envelope > Mechanical > Surfaces > Finishes (spend money in the right order).`
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
    case 'get_knowledge_tree':
      return getKnowledgeTreeForTool(input, projectId)
    case 'get_blockers':
      return getBlockersForTool(projectId)
    case 'get_cascade_requirements':
      return getCascadeForTool(input)
    case 'get_workflow_status':
      return getWorkflowStatusForTool(projectId)
    case 'get_workflow_alerts':
      return getWorkflowAlertsForTool(projectId)
    case 'research_topic':
      return researchTopicForTool(input, projectId)
    case 'get_plan_extractions':
      return getPlanExtractionsForTool(input, projectId)
    case 'get_vendor_threads':
      return getVendorThreadsForTool(input, projectId)
    case 'get_follow_ups':
      return getFollowUpsForTool(input, projectId)
    case 'get_change_orders':
      return getChangeOrdersForTool(input, projectId)
    case 'get_draw_schedule':
      return getDrawScheduleForTool(projectId)
    case 'get_warranties':
      return getWarrantiesForTool(input, projectId)
    case 'get_punch_list':
      return getPunchListForTool(input, projectId)
    case 'get_inspections':
      return getInspectionsForTool(input, projectId)
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
      knowledge_id: s.knowledge_id,
      needed_by_phase: s.needed_by_phase,
      needed_by_date: s.needed_by_date,
      lead_time_days: s.lead_time_days,
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
// Knowledge graph tool handlers
// ---------------------------------------------------------------------------

async function getKnowledgeTreeForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const phaseNumber = input.phase_number as number | undefined
  const trade = input.trade as string | undefined

  const tree = await getKnowledgeTree(projectId, {
    phase_number: phaseNumber,
    trade,
  })

  // Flatten for a more readable tool response
  function flattenNode(node: { id: string; item_name: string; trade: string; phase_number: number; item_type: string; description: string | null; decision_required: boolean; inspection_required: boolean; typical_duration_days: number | null; typical_cost_range: { min: number; max: number } | null; decision_options: Array<{ option: string; pros?: string; cons?: string; cost_impact?: string }> | null; state?: { status: string; notes: string | null } | null; children: typeof tree }, depth = 0): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [{
      id: node.id,
      depth,
      item_name: node.item_name,
      trade: node.trade,
      phase: node.phase_number,
      type: node.item_type,
      description: node.description,
      decision_required: node.decision_required || undefined,
      inspection_required: node.inspection_required || undefined,
      duration_days: node.typical_duration_days,
      cost_range: node.typical_cost_range,
      decision_options: node.decision_options,
      status: node.state?.status || 'not_tracked',
      notes: node.state?.notes,
    }]
    for (const child of node.children) {
      result.push(...flattenNode(child, depth + 1))
    }
    return result
  }

  const flattened = tree.flatMap(node => flattenNode(node))

  // Also get summary stats
  const summary = await getKnowledgeStateSummary(projectId)

  return JSON.stringify({
    summary,
    count: flattened.length,
    items: flattened,
  })
}

async function getBlockersForTool(projectId: string): Promise<string> {
  const [blockers, readyItems] = await Promise.all([
    getBlockers(projectId),
    (async () => {
      const { getReadyItems } = await import('./knowledge-graph')
      return getReadyItems(projectId)
    })(),
  ])

  return JSON.stringify({
    blockers: blockers.map(b => ({
      item_name: b.item.item_name,
      trade: b.item.trade,
      phase: b.item.phase_number,
      blocking_reason: b.state.blocking_reason,
      unmet_dependencies: b.unmetDependencies.map(d => d.item_name),
    })),
    ready_to_start: readyItems.slice(0, 20).map(r => ({
      id: r.id,
      item_name: r.item_name,
      trade: r.trade,
      phase: r.phase_number,
      type: r.item_type,
      duration_days: r.typical_duration_days,
    })),
  })
}

async function getCascadeForTool(input: Record<string, unknown>): Promise<string> {
  const itemId = input.item_id as string
  if (!itemId) {
    return JSON.stringify({ error: 'Missing required field: item_id' })
  }

  try {
    const cascade = await getCascadingRequirements(itemId)

    return JSON.stringify({
      item: {
        id: cascade.item.id,
        name: cascade.item.item_name,
        trade: cascade.item.trade,
        phase: cascade.item.phase_number,
      },
      prerequisites: cascade.prerequisites.map(p => ({
        name: p.item_name,
        trade: p.trade,
        type: p.item_type,
      })),
      downstream: cascade.downstream.map(d => ({
        name: d.item_name,
        trade: d.trade,
        type: d.item_type,
      })),
      materials: cascade.materials,
      inspections: cascade.inspections.map(i => ({
        name: i.item_name,
        code_refs: i.code_references,
      })),
    })
  } catch {
    return JSON.stringify({ error: `Knowledge item not found: ${itemId}` })
  }
}

// ---------------------------------------------------------------------------
// Workflow tool handlers
// ---------------------------------------------------------------------------

async function getWorkflowStatusForTool(projectId: string): Promise<string> {
  const overview = await getWorkflowOverview(projectId)

  return JSON.stringify({
    overall_progress: overview.stats.totalItems > 0
      ? Math.round((overview.stats.completed / overview.stats.totalItems) * 100)
      : 0,
    stats: overview.stats,
    phases: overview.phases.map(p => ({
      phase: p.phase_number,
      name: p.name,
      status: p.status,
      progress: `${p.completed_items}/${p.total_items} (${p.progress_percentage}%)`,
      blocked: p.blocked_items,
      ready: p.ready_items,
    })),
  })
}

async function getWorkflowAlertsForTool(projectId: string): Promise<string> {
  const alerts = await getWorkflowAlerts(projectId)

  return JSON.stringify({
    count: alerts.length,
    alerts: alerts.map(a => ({
      type: a.type,
      priority: a.priority,
      title: a.title,
      message: a.message,
      phase: a.phase_number,
      knowledge_id: a.knowledge_id,
    })),
  })
}

// ---------------------------------------------------------------------------
// Phase 7-8 tool handlers (Punch List, Inspections)
// ---------------------------------------------------------------------------

async function getPunchListForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  if (input.view === 'stats') {
    const stats = await getPunchListStats(projectId)
    return JSON.stringify(stats)
  }

  const items = await getPunchList(projectId, {
    room: input.room as string | undefined,
    severity: input.severity as PunchSeverity | undefined,
    status: input.status as PunchStatus | undefined,
  })

  return JSON.stringify({
    count: items.length,
    items: items.map(i => ({
      id: i.id,
      room: i.room,
      description: i.description,
      severity: i.severity,
      status: i.status,
      assigned_to: i.assigned_vendor_name,
      source: i.source,
      due_date: i.due_date,
      notes: i.notes,
    })),
  })
}

async function getInspectionsForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const inspections = await getInspections(projectId, {
    status: input.status as InspectionStatus | undefined,
  })

  return JSON.stringify({
    count: inspections.length,
    inspections: inspections.map(i => ({
      id: i.id,
      type: i.inspection_type,
      status: i.status,
      scheduled_date: i.scheduled_date,
      completed_date: i.completed_date,
      inspector: i.inspector_name,
      deficiencies_count: i.deficiencies?.length || 0,
      notes: i.notes,
    })),
  })
}

// ---------------------------------------------------------------------------
// Phase 6 tool handlers (Change Orders, Draw Schedule, Warranties)
// ---------------------------------------------------------------------------

async function getChangeOrdersForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const [orders, summary] = await Promise.all([
    getChangeOrders(projectId, { status: input.status as never }),
    getChangeOrderSummary(projectId),
  ])

  return JSON.stringify({
    summary,
    count: orders.length,
    change_orders: orders.map(o => ({
      id: o.id,
      co_number: o.change_order_number,
      title: o.title,
      reason: o.reason,
      status: o.status,
      cost_impact: o.cost_impact,
      schedule_impact_days: o.schedule_impact_days,
      category: o.category,
      approved_date: o.approved_date,
      notes: o.notes,
    })),
  })
}

async function getDrawScheduleForTool(projectId: string): Promise<string> {
  const [draws, summary] = await Promise.all([
    getDrawSchedule(projectId),
    getDrawSummary(projectId),
  ])

  return JSON.stringify({
    summary: {
      total_draws: summary.total_draws,
      total_amount: summary.total_amount,
      funded: summary.funded_amount,
      pending: summary.pending_amount,
      next_draw: summary.next_draw ? {
        draw_number: summary.next_draw.draw_number,
        amount: summary.next_draw.amount,
        milestone: summary.next_draw.milestone_name,
        status: summary.next_draw.status,
      } : null,
    },
    draws: draws.map(d => ({
      draw_number: d.draw_number,
      amount: d.amount,
      milestone: d.milestone_name,
      status: d.status,
      request_date: d.request_date,
      funded_date: d.funded_date,
    })),
  })
}

async function getWarrantiesForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const view = input.view as string | undefined

  if (view === 'expiring') {
    const expiring = await getExpiringWarranties(projectId)
    return JSON.stringify({
      count: expiring.length,
      warranties: expiring.map(w => ({
        vendor: w.vendor_name,
        category: w.category,
        item: w.item_description,
        type: w.warranty_type,
        end_date: w.end_date,
        status: w.status,
      })),
    })
  }

  if (view === 'compliance_gaps') {
    const gaps = await getComplianceGaps(projectId)
    return JSON.stringify({
      expired: gaps.expired.map(c => ({ vendor: c.vendor_name, type: c.insurance_type, expired: c.expiration_date })),
      expiring_soon: gaps.expiring_soon.map(c => ({ vendor: c.vendor_name, type: c.insurance_type, expires: c.expiration_date })),
      unverified: gaps.unverified.map(c => ({ vendor: c.vendor_name, type: c.insurance_type })),
    })
  }

  const warranties = await getWarranties(projectId)
  return JSON.stringify({
    count: warranties.length,
    warranties: warranties.map(w => ({
      id: w.id,
      vendor: w.vendor_name,
      category: w.category,
      item: w.item_description,
      type: w.warranty_type,
      start_date: w.start_date,
      end_date: w.end_date,
      status: w.status,
    })),
  })
}

// ---------------------------------------------------------------------------
// Vendor thread tool handlers
// ---------------------------------------------------------------------------

async function getVendorThreadsForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const status = input.status as string | undefined
  const category = input.category as string | undefined

  const threads = await getVendorThreads(projectId, { status, category })

  return JSON.stringify({
    count: threads.length,
    threads: threads.map(t => ({
      id: t.id,
      vendor_name: t.vendor_name,
      vendor_email: t.vendor_email,
      category: t.category,
      status: t.status,
      days_since_contact: t.days_since_contact,
      bid_requested: t.bid_requested_date,
      bid_received: t.bid_received_date,
      follow_up_date: t.follow_up_date,
      notes: t.notes,
    })),
  })
}

async function getFollowUpsForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const threshold = (input.threshold_days as number) || 5

  const followUps = await getFollowUpsNeeded(projectId, threshold)

  return JSON.stringify({
    count: followUps.length,
    follow_ups: followUps.map(f => ({
      vendor_name: f.thread.vendor_name,
      vendor_email: f.thread.vendor_email,
      category: f.thread.category,
      days_waiting: f.days_waiting,
      reason: f.reason,
      thread_id: f.thread.id,
    })),
  })
}

// ---------------------------------------------------------------------------
// Plan extractions tool handler
// ---------------------------------------------------------------------------

async function getPlanExtractionsForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const view = input.view as string | undefined
  const type = input.type as ExtractionType | undefined

  if (view === 'rooms') {
    const rooms = await getRoomSchedule(projectId)
    return JSON.stringify({
      count: rooms.length,
      rooms: rooms.map(r => ({
        name: r.name,
        floor: r.floor,
        sqft: r.square_footage,
        ceiling_height: r.ceiling_height,
        fixtures: r.fixtures,
        finishes: r.finishes,
      })),
    })
  }

  if (view === 'fixtures') {
    const summary = await getFixtureSummary(projectId)
    return JSON.stringify(summary)
  }

  const extractions = await getExtractions(projectId, { type })
  return JSON.stringify({
    count: extractions.length,
    extractions: extractions.map(e => ({
      id: e.id,
      type: e.extraction_type,
      confidence: e.confidence,
      reviewed: e.reviewed,
      data: e.extracted_data,
      notes: e.ai_notes,
    })),
  })
}

// ---------------------------------------------------------------------------
// Research tool handler
// ---------------------------------------------------------------------------

async function researchTopicForTool(
  input: Record<string, unknown>,
  projectId: string
): Promise<string> {
  const query = input.query as string
  if (!query) {
    return JSON.stringify({ error: 'Missing required field: query' })
  }

  const searchType = (input.type as ResearchType) || 'general'
  const knowledgeId = input.knowledge_id as string | undefined

  try {
    const result = await executeResearch({
      projectId,
      query,
      searchType,
      knowledgeId,
    })

    return JSON.stringify({
      query: result.query,
      type: result.search_type,
      analysis: result.ai_analysis,
      findings: result.results,
      sources: result.sources.map(s => ({
        title: s.title,
        url: s.url,
      })),
      cached_until: result.expires_at,
    })
  } catch (error) {
    return JSON.stringify({
      error: `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  }
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
    complete_workflow_item: i => `Complete workflow item ${i.knowledge_id}${i.notes ? ` — ${i.notes}` : ''}`,
    create_change_order: i => `Create CO: ${i.title} (${i.reason})${i.cost_impact ? ` $${Number(i.cost_impact).toLocaleString()}` : ''}`,
    add_punch_item: i => `Add punch item: ${i.description}${i.room ? ` in ${i.room}` : ''} [${i.severity || 'functional'}]`,
    schedule_inspection: i => `Schedule inspection: ${i.inspection_type}${i.scheduled_date ? ` on ${i.scheduled_date}` : ''}`,
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
