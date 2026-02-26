import { supabase } from './supabase'
import { getProject, getBudgetSummary } from './project-service'
import { getBids } from './bids-service'
import { getSelections } from './selections-service'
import { db } from './database'
import type { PendingAction, ActionType } from '@/types'
import type Anthropic from '@anthropic-ai/sdk'

export async function buildAssistantContext(): Promise<{
  systemPrompt: string
  projectId: string
}> {
  const project = await getProject()
  if (!project) throw new Error('No project found')

  const [
    budgetSummary,
    bids,
    selections,
    latestStatus,
    recentEmails,
    { data: contacts },
    { data: planningSteps },
    { data: milestones },
  ] = await Promise.all([
    getBudgetSummary(project.id),
    getBids(project.id),
    getSelections(project.id),
    db.getLatestProjectStatus(project.id),
    db.getRecentEmails(14),
    supabase.from('contacts').select('*').eq('project_id', project.id),
    supabase.from('planning_phase_steps').select('*').eq('project_id', project.id).order('step_number'),
    supabase.from('milestones').select('*').eq('project_id', project.id).order('target_date'),
  ])

  const budgetTotal = parseFloat(project.budget_total || '450000')

  const systemPrompt = `You are the Project Assistant for a home construction project.

TODAY: ${new Date().toISOString().split('T')[0]}

PROJECT:
- Address: ${project.address || 'Not set'}
- Phase: ${project.phase || 'planning'}
- Budget: $${budgetTotal.toLocaleString()} total, $${budgetSummary.spent.toLocaleString()} spent, $${(budgetTotal - budgetSummary.spent).toLocaleString()} remaining

PLANNING STEPS:
${(planningSteps || []).map((s: { step_number: number; name: string; status: string }) => `- Step ${s.step_number}: ${s.name} [${s.status}]`).join('\n') || 'None'}

MILESTONES:
${(milestones || []).map((m: { name: string; status: string; target_date?: string }) => `- ${m.name}: ${m.status} (target: ${m.target_date || 'TBD'})`).join('\n') || 'None'}

BUDGET BY CATEGORY:
${budgetSummary.categories.map((c: { category: string; estimated_cost: string; actual_cost: string; status?: string }) => `- ${c.category}: Est $${parseFloat(c.estimated_cost || '0').toLocaleString()} / Actual $${parseFloat(c.actual_cost || '0').toLocaleString()}${c.status ? ' [' + c.status + ']' : ''}`).join('\n') || 'No items'}

BIDS (${bids.length}):
${bids.slice(0, 30).map(b => `- ${b.vendor_name} | ${b.category}${b.subcategory ? '/' + b.subcategory : ''} | $${b.total_amount.toLocaleString()} | ${b.status}${b.lead_time_weeks ? ' | ' + b.lead_time_weeks + 'wk lead' : ''}`).join('\n') || 'None'}

SELECTIONS (${selections.length}):
${selections.slice(0, 20).map(s => `- ${s.room}: ${s.product_name} (${s.category}) [$${(s.total_price || 0).toLocaleString()}] [${s.status}]`).join('\n') || 'None'}

CONTACTS:
${(contacts || []).map((c: { name: string; role: string; email?: string; phone?: string }) => `- ${c.name}: ${c.role}${c.email ? ' | ' + c.email : ''}${c.phone ? ' | ' + c.phone : ''}`).join('\n') || 'None'}

RECENT EMAILS (last 14 days):
${recentEmails.slice(0, 10).map(e => `- ${e.sender_name || e.sender_email}: "${e.subject}" (${e.received_date?.split('T')[0]})${e.ai_summary ? ' — ' + e.ai_summary.substring(0, 150) : ''}`).join('\n') || 'None'}

LATEST STATUS:
${latestStatus?.ai_summary || 'No status report yet.'}

INSTRUCTIONS:
- Answer questions using the data above. Be specific with amounts, dates, and names.
- When the user provides new information (quotes, price updates, decisions), use the appropriate tool to propose the change.
- You can call multiple tools if the user provides multiple pieces of information.
- Always explain what you found or what change you're proposing.
- When comparing bids, note price differences, lead times, and any pros/cons.`

  return { systemPrompt, projectId: project.id }
}

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'update_bid',
    description: 'Update an existing bid. Use when a vendor revised their price or terms.',
    input_schema: {
      type: 'object' as const,
      properties: {
        vendor_name: { type: 'string', description: 'Vendor name to match' },
        category: { type: 'string', description: 'Category to disambiguate' },
        total_amount: { type: 'number', description: 'New total if price changed' },
        status: { type: 'string', enum: ['pending', 'under_review', 'selected', 'rejected', 'expired'] },
        internal_notes: { type: 'string' },
        lead_time_weeks: { type: 'number' },
        payment_terms: { type: 'string' },
      },
      required: ['vendor_name'],
    },
  },
  {
    name: 'add_bid',
    description: 'Add a new bid from a vendor.',
    input_schema: {
      type: 'object' as const,
      properties: {
        vendor_name: { type: 'string' },
        category: { type: 'string' },
        subcategory: { type: 'string' },
        description: { type: 'string' },
        total_amount: { type: 'number' },
        vendor_email: { type: 'string' },
        vendor_phone: { type: 'string' },
        scope_of_work: { type: 'string' },
        lead_time_weeks: { type: 'number' },
        payment_terms: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['vendor_name', 'category', 'total_amount'],
    },
  },
  {
    name: 'update_budget_item',
    description: 'Update a budget line item actual cost or status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Budget category to match' },
        description: { type: 'string', description: 'Description fragment to match' },
        actual_cost: { type: 'number' },
        estimated_cost: { type: 'number' },
        status: { type: 'string', enum: ['pending', 'approved', 'paid', 'over_budget'] },
        notes: { type: 'string' },
      },
      required: ['category'],
    },
  },
  {
    name: 'add_budget_item',
    description: 'Add a new budget line item.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string' },
        subcategory: { type: 'string' },
        description: { type: 'string' },
        estimated_cost: { type: 'number' },
        actual_cost: { type: 'number' },
        status: { type: 'string', enum: ['pending', 'approved', 'paid'] },
        notes: { type: 'string' },
      },
      required: ['category', 'description', 'estimated_cost'],
    },
  },
  {
    name: 'update_selection',
    description: 'Update a product selection status, price, or details.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_name: { type: 'string', description: 'Product name to match' },
        room: { type: 'string', description: 'Room to disambiguate' },
        status: { type: 'string', enum: ['considering', 'selected', 'ordered', 'received', 'installed', 'alternative'] },
        unit_price: { type: 'number' },
        total_price: { type: 'number' },
        notes: { type: 'string' },
        lead_time: { type: 'string' },
        order_date: { type: 'string' },
      },
      required: ['product_name'],
    },
  },
  {
    name: 'add_contact',
    description: 'Add a new contact (vendor, consultant, contractor).',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        role: { type: 'string' },
        company: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['name', 'role'],
    },
  },
  {
    name: 'update_planning_step',
    description: 'Update the status of a planning phase step (1-6).',
    input_schema: {
      type: 'object' as const,
      properties: {
        step_number: { type: 'number', description: 'Step number 1-6' },
        status: { type: 'string', enum: ['not_started', 'in_progress', 'completed'] },
        notes: { type: 'string' },
      },
      required: ['step_number', 'status'],
    },
  },
]

export function parseToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  toolCallId: string,
): PendingAction {
  const labels: Record<string, () => string> = {
    update_bid: () => `Update ${toolInput.vendor_name} bid${toolInput.total_amount ? ` to $${(toolInput.total_amount as number).toLocaleString()}` : ''}`,
    add_bid: () => `Add bid: ${toolInput.vendor_name} — ${toolInput.category} ($${(toolInput.total_amount as number).toLocaleString()})`,
    update_budget_item: () => `Update budget: ${toolInput.category}${toolInput.actual_cost ? ` actual $${(toolInput.actual_cost as number).toLocaleString()}` : ''}`,
    add_budget_item: () => `Add budget item: ${toolInput.description} ($${(toolInput.estimated_cost as number).toLocaleString()})`,
    update_selection: () => `Update selection: ${toolInput.product_name}${toolInput.status ? ` → ${toolInput.status}` : ''}`,
    add_contact: () => `Add contact: ${toolInput.name} (${toolInput.role})`,
    update_planning_step: () => `Update Step ${toolInput.step_number} → ${toolInput.status}`,
  }

  return {
    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: toolName as ActionType,
    label: (labels[toolName] || (() => `${toolName}: ${JSON.stringify(toolInput)}`))(),
    description: 'Proposed by assistant based on your input',
    data: toolInput,
    status: 'pending',
    toolCallId,
  }
}
