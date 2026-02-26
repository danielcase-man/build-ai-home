import { describe, it, expect } from 'vitest'
import { parseToolCall, ASSISTANT_TOOLS } from './assistant'

describe('ASSISTANT_TOOLS', () => {
  it('defines 7 tools', () => {
    expect(ASSISTANT_TOOLS).toHaveLength(7)
  })

  it('all tools have name, description, and input_schema', () => {
    for (const tool of ASSISTANT_TOOLS) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
      expect(tool.input_schema.required).toBeDefined()
    }
  })

  it('includes expected tool names', () => {
    const names = ASSISTANT_TOOLS.map(t => t.name)
    expect(names).toContain('update_bid')
    expect(names).toContain('add_bid')
    expect(names).toContain('update_budget_item')
    expect(names).toContain('add_budget_item')
    expect(names).toContain('update_selection')
    expect(names).toContain('add_contact')
    expect(names).toContain('update_planning_step')
  })
})

describe('parseToolCall', () => {
  it('creates update_bid action with amount', () => {
    const action = parseToolCall('update_bid', { vendor_name: 'Prestige Steel', total_amount: 72000 }, 'call-1')
    expect(action.type).toBe('update_bid')
    expect(action.label).toContain('Prestige Steel')
    expect(action.label).toContain('$72,000')
    expect(action.status).toBe('pending')
    expect(action.toolCallId).toBe('call-1')
    expect(action.id).toMatch(/^action-/)
  })

  it('creates update_bid action without amount', () => {
    const action = parseToolCall('update_bid', { vendor_name: 'CobraStone', status: 'selected' }, 'call-2')
    expect(action.label).toContain('CobraStone')
    expect(action.label).not.toContain('$')
  })

  it('creates add_bid action', () => {
    const action = parseToolCall('add_bid', { vendor_name: 'NewCo', category: 'Roofing', total_amount: 50000 }, 'call-3')
    expect(action.type).toBe('add_bid')
    expect(action.label).toContain('NewCo')
    expect(action.label).toContain('Roofing')
    expect(action.label).toContain('$50,000')
  })

  it('creates add_budget_item action', () => {
    const action = parseToolCall('add_budget_item', { description: 'Landscaping', estimated_cost: 25000 }, 'call-4')
    expect(action.label).toContain('Landscaping')
    expect(action.label).toContain('$25,000')
  })

  it('creates update_selection action', () => {
    const action = parseToolCall('update_selection', { product_name: 'Monarch Manor', status: 'ordered' }, 'call-5')
    expect(action.label).toContain('Monarch Manor')
    expect(action.label).toContain('ordered')
  })

  it('creates add_contact action', () => {
    const action = parseToolCall('add_contact', { name: 'John Doe', role: 'Plumber' }, 'call-6')
    expect(action.label).toContain('John Doe')
    expect(action.label).toContain('Plumber')
  })

  it('creates update_planning_step action', () => {
    const action = parseToolCall('update_planning_step', { step_number: 3, status: 'completed' }, 'call-7')
    expect(action.label).toContain('Step 3')
    expect(action.label).toContain('completed')
  })

  it('handles unknown tool with fallback label', () => {
    const action = parseToolCall('unknown_tool', { foo: 'bar' }, 'call-8')
    expect(action.type).toBe('unknown_tool')
    expect(action.label).toContain('unknown_tool')
  })

  it('stores data payload in action', () => {
    const input = { vendor_name: 'Test', total_amount: 100 }
    const action = parseToolCall('update_bid', input, 'call-9')
    expect(action.data).toEqual(input)
  })
})
