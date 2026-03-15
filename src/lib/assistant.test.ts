import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the service dependencies before importing
vi.mock('./project-service', () => ({
  getProject: vi.fn().mockResolvedValue({
    id: 'proj-1',
    address: '708 Purple Salvia Cove, Liberty Hill, TX',
    phase: 'planning',
    budget_total: '450000',
    created_at: '2025-01-01T00:00:00Z',
  }),
  getBudgetSummary: vi.fn().mockResolvedValue({ total: 450000, spent: 12000, categories: [] }),
}))

vi.mock('./bids-service', () => ({
  getBids: vi.fn().mockResolvedValue([
    {
      id: 'bid-1',
      vendor_name: 'Pella Windows',
      vendor_email: 'pella@example.com',
      category: 'Windows',
      subcategory: null,
      description: 'All windows',
      total_amount: 85000,
      status: 'pending',
      bid_date: '2025-06-01',
      lead_time_weeks: 12,
      scope_of_work: 'Supply and install',
      inclusions: ['labor'],
      exclusions: ['trim'],
      pros: null,
      cons: null,
      internal_notes: null,
      selection_notes: null,
      vendor_phone: null,
    },
    {
      id: 'bid-2',
      vendor_name: 'Doorwin',
      vendor_email: 'doorwin@example.com',
      category: 'Windows',
      subcategory: null,
      description: 'Custom windows',
      total_amount: 120000,
      status: 'under_review',
      bid_date: '2025-06-15',
      lead_time_weeks: 16,
      scope_of_work: 'Supply only',
      inclusions: null,
      exclusions: null,
      pros: null,
      cons: null,
      internal_notes: null,
      selection_notes: null,
      vendor_phone: null,
    },
    {
      id: 'bid-3',
      vendor_name: 'CobraStone',
      vendor_email: null,
      category: 'Stone',
      subcategory: null,
      description: 'Exterior stone',
      total_amount: 85000,
      status: 'selected',
      bid_date: '2025-05-20',
      lead_time_weeks: 8,
      scope_of_work: 'Supply and install stone veneer',
      inclusions: null,
      exclusions: null,
      pros: null,
      cons: null,
      internal_notes: null,
      selection_notes: null,
      vendor_phone: null,
    },
  ]),
}))

vi.mock('./budget-service', () => ({
  getBudgetItems: vi.fn().mockResolvedValue([
    {
      id: 'bi-1',
      category: 'Foundation',
      subcategory: null,
      description: 'Foundation work',
      estimated_cost: 50000,
      actual_cost: 48000,
      status: 'completed',
      notes: null,
    },
    {
      id: 'bi-2',
      category: 'Windows',
      subcategory: null,
      description: 'Windows supply and install',
      estimated_cost: 90000,
      actual_cost: null,
      status: 'estimated',
      notes: null,
    },
  ]),
}))

vi.mock('./selections-service', () => ({
  getSelections: vi.fn().mockResolvedValue([
    {
      id: 'sel-1',
      room: 'Kitchen',
      category: 'appliance',
      subcategory: 'range',
      product_name: 'AGA Professional',
      brand: 'AGA',
      model_number: 'AGA-PRO-48',
      finish: 'Stainless',
      color: null,
      quantity: 1,
      unit_price: 12000,
      total_price: 12000,
      status: 'selected',
      lead_time: '8 weeks',
      notes: null,
      product_url: null,
    },
  ]),
}))

vi.mock('./database', () => ({
  db: {
    getRecentEmails: vi.fn().mockResolvedValue([
      {
        id: 'email-1',
        subject: 'Window bid attached',
        sender_email: 'vendor@pella.com',
        sender_name: 'Pella Rep',
        received_date: '2025-06-14T10:00:00Z',
        ai_summary: 'Pella sent updated window quote for $85K',
        is_read: true,
        category: 'bid',
        urgency_level: 'medium',
      },
    ]),
    getLatestProjectStatus: vi.fn().mockResolvedValue({
      date: '2025-06-14',
      ai_summary: 'Project on track.',
      hot_topics: [{ priority: 'high', text: 'Window vendor selection pending' }],
      action_items: [{ status: 'pending', text: 'Compare window bids' }],
      recent_decisions: [{ decision: 'Selected AGA range', impact: 'Budget +$2K over Viking estimate' }],
      next_steps: ['Finalize window vendor selection'],
      open_questions: [{ question: 'Lead time for Pella?', askedBy: 'Owner' }],
      key_data_points: [{ category: 'Budget', data: 'Window budget is $90K', importance: 'important' }],
    }),
    getProjectStatusHistory: vi.fn().mockResolvedValue([
      {
        date: '2025-06-14',
        ai_summary: 'Project on track.',
        hot_topics: [{ priority: 'high', text: 'Window vendor selection pending' }],
        action_items: [{ status: 'pending', text: 'Compare window bids' }],
        recent_decisions: [],
        next_steps: ['Finalize window vendor selection'],
        open_questions: [],
        key_data_points: [],
      },
    ]),
  },
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            then: vi.fn().mockResolvedValue({ data: [
              { step_number: 1, name: 'Consultation', status: 'completed' },
              { step_number: 2, name: 'Lot Analysis', status: 'in_progress' },
            ]}),
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
              then: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      }),
    }),
  },
}))

import {
  ASSISTANT_TOOLS,
  READ_TOOL_NAMES,
  WRITE_TOOL_NAMES,
  isReadTool,
  isWriteTool,
  buildSystemPrompt,
  executeReadTool,
  parseToolCall,
  getToolStatusLabel,
} from './assistant'

describe('assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------
  // Tool definitions
  // -------------------------------------------------------------------

  describe('ASSISTANT_TOOLS', () => {
    it('has 33 tools total (22 read + 11 write)', () => {
      expect(ASSISTANT_TOOLS).toHaveLength(33)
    })

    it('contains all expected read tools', () => {
      const names = ASSISTANT_TOOLS.map(t => t.name)
      expect(names).toContain('get_project_overview')
      expect(names).toContain('search_bids')
      expect(names).toContain('get_budget_items')
      expect(names).toContain('get_selections')
      expect(names).toContain('search_emails')
      expect(names).toContain('get_contacts')
      expect(names).toContain('get_planning_steps')
      expect(names).toContain('get_status_history')
      expect(names).toContain('get_knowledge_tree')
      expect(names).toContain('get_blockers')
      expect(names).toContain('get_cascade_requirements')
      expect(names).toContain('get_workflow_status')
      expect(names).toContain('get_workflow_alerts')
      expect(names).toContain('research_topic')
      expect(names).toContain('get_plan_extractions')
      expect(names).toContain('get_vendor_threads')
      expect(names).toContain('get_follow_ups')
      expect(names).toContain('get_change_orders')
      expect(names).toContain('get_draw_schedule')
      expect(names).toContain('get_warranties')
      expect(names).toContain('get_punch_list')
      expect(names).toContain('get_inspections')
    })

    it('contains all expected write tools', () => {
      const names = ASSISTANT_TOOLS.map(t => t.name)
      expect(names).toContain('update_bid')
      expect(names).toContain('add_bid')
      expect(names).toContain('update_selection')
      expect(names).toContain('add_selection')
      expect(names).toContain('update_budget_item')
      expect(names).toContain('add_budget_item')
      expect(names).toContain('update_milestone')
      expect(names).toContain('complete_workflow_item')
      expect(names).toContain('create_change_order')
      expect(names).toContain('add_punch_item')
      expect(names).toContain('schedule_inspection')
    })

    it('every tool has a valid input_schema', () => {
      for (const tool of ASSISTANT_TOOLS) {
        expect(tool.input_schema).toBeDefined()
        expect(tool.input_schema.type).toBe('object')
      }
    })
  })

  // -------------------------------------------------------------------
  // isReadTool / isWriteTool
  // -------------------------------------------------------------------

  describe('isReadTool', () => {
    it('returns true for read tools', () => {
      for (const name of READ_TOOL_NAMES) {
        expect(isReadTool(name)).toBe(true)
      }
    })

    it('returns false for write tools', () => {
      for (const name of WRITE_TOOL_NAMES) {
        expect(isReadTool(name)).toBe(false)
      }
    })

    it('returns false for unknown tools', () => {
      expect(isReadTool('unknown_tool')).toBe(false)
    })
  })

  describe('isWriteTool', () => {
    it('returns true for write tools', () => {
      for (const name of WRITE_TOOL_NAMES) {
        expect(isWriteTool(name)).toBe(true)
      }
    })

    it('returns false for read tools', () => {
      for (const name of READ_TOOL_NAMES) {
        expect(isWriteTool(name)).toBe(false)
      }
    })
  })

  // -------------------------------------------------------------------
  // buildSystemPrompt
  // -------------------------------------------------------------------

  describe('buildSystemPrompt', () => {
    it('returns a lightweight prompt with project metadata', async () => {
      const prompt = await buildSystemPrompt('proj-1')

      expect(prompt).toContain('Project Assistant')
      expect(prompt).toContain('708 Purple Salvia Cove')
      expect(prompt).toContain('planning')
      expect(prompt).toContain('$450,000')
      expect(prompt).toContain('READ tools')
      expect(prompt).toContain('WRITE tools')
    })

    it('does not include detailed bid, selection, or email data', async () => {
      const prompt = await buildSystemPrompt('proj-1')

      expect(prompt).not.toContain('Pella')
      expect(prompt).not.toContain('Doorwin')
      expect(prompt).not.toContain('AGA')
      expect(prompt).not.toContain('Window bid attached')
      expect(prompt.length).toBeLessThan(1000)
    })
  })

  // -------------------------------------------------------------------
  // executeReadTool
  // -------------------------------------------------------------------

  describe('executeReadTool', () => {
    it('search_bids returns filtered results by category', async () => {
      const result = await executeReadTool('search_bids', { category: 'Windows' }, 'proj-1')
      const parsed = JSON.parse(result)

      expect(parsed.count).toBe(2)
      expect(parsed.bids[0].vendor_name).toBe('Pella Windows')
      expect(parsed.bids[1].vendor_name).toBe('Doorwin')
    })

    it('search_bids returns filtered results by vendor', async () => {
      const result = await executeReadTool('search_bids', { vendor_name: 'Cobra' }, 'proj-1')
      const parsed = JSON.parse(result)

      expect(parsed.count).toBe(1)
      expect(parsed.bids[0].category).toBe('Stone')
    })

    it('search_bids returns all bids when no filters', async () => {
      const result = await executeReadTool('search_bids', {}, 'proj-1')
      const parsed = JSON.parse(result)

      expect(parsed.count).toBe(3)
    })

    it('get_budget_items returns filtered by category', async () => {
      const result = await executeReadTool('get_budget_items', { category: 'Foundation' }, 'proj-1')
      const parsed = JSON.parse(result)

      expect(parsed.count).toBe(1)
      expect(parsed.items[0].category).toBe('Foundation')
      expect(parsed.total_estimated).toBe(50000)
      expect(parsed.total_actual).toBe(48000)
    })

    it('get_selections returns filtered by room', async () => {
      const result = await executeReadTool('get_selections', { room: 'Kitchen' }, 'proj-1')
      const parsed = JSON.parse(result)

      expect(parsed.count).toBe(1)
      expect(parsed.selections[0].product_name).toBe('AGA Professional')
    })

    it('search_emails filters by query', async () => {
      const result = await executeReadTool('search_emails', { query: 'window' }, 'proj-1')
      const parsed = JSON.parse(result)

      expect(parsed.count).toBe(1)
      expect(parsed.emails[0].subject).toContain('Window')
    })

    it('search_emails returns empty for non-matching query', async () => {
      const result = await executeReadTool('search_emails', { query: 'nonexistent' }, 'proj-1')
      const parsed = JSON.parse(result)

      expect(parsed.count).toBe(0)
    })

    it('returns error for unknown tool', async () => {
      const result = await executeReadTool('not_a_tool', {}, 'proj-1')
      const parsed = JSON.parse(result)

      expect(parsed.error).toContain('Unknown read tool')
    })
  })

  // -------------------------------------------------------------------
  // parseToolCall
  // -------------------------------------------------------------------

  describe('parseToolCall', () => {
    it('creates a PendingAction for add_bid', () => {
      const action = parseToolCall(
        'add_bid',
        { vendor_name: 'TestCo', category: 'Roofing', description: 'Roof', total_amount: 50000 },
        'tool-123'
      )

      expect(action.type).toBe('add_bid')
      expect(action.tool_use_id).toBe('tool-123')
      expect(action.description).toContain('TestCo')
      expect(action.description).toContain('Roofing')
      expect(action.description).toContain('$50,000')
      expect(action.data.vendor_name).toBe('TestCo')
      expect(action.id).toMatch(/^action_/)
    })

    it('creates a PendingAction for update_bid with status', () => {
      const action = parseToolCall(
        'update_bid',
        { bid_id: 'bid-1', status: 'selected' },
        'tool-456'
      )

      expect(action.type).toBe('update_bid')
      expect(action.description).toContain('selected')
    })

    it('creates a PendingAction for add_selection', () => {
      const action = parseToolCall(
        'add_selection',
        { product_name: 'Brizo Faucet', room: 'Master Bath', category: 'plumbing', quantity: 1 },
        'tool-789'
      )

      expect(action.type).toBe('add_selection')
      expect(action.description).toContain('Brizo Faucet')
      expect(action.description).toContain('Master Bath')
    })

    it('creates a PendingAction for add_budget_item', () => {
      const action = parseToolCall(
        'add_budget_item',
        { category: 'Landscaping', description: 'Front yard', estimated_cost: 25000 },
        'tool-abc'
      )

      expect(action.type).toBe('add_budget_item')
      expect(action.description).toContain('Landscaping')
      expect(action.description).toContain('$25,000')
    })
  })

  // -------------------------------------------------------------------
  // getToolStatusLabel
  // -------------------------------------------------------------------

  describe('getToolStatusLabel', () => {
    it('returns a human-readable label for known tools', () => {
      expect(getToolStatusLabel('search_bids')).toContain('bids')
      expect(getToolStatusLabel('get_project_overview')).toContain('project')
      expect(getToolStatusLabel('search_emails')).toContain('emails')
    })

    it('returns a fallback for unknown tools', () => {
      expect(getToolStatusLabel('unknown')).toContain('unknown')
    })
  })
})
