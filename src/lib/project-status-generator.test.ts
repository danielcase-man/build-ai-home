import { describe, it, expect } from 'vitest'
import { generateProjectStatusFromData } from './project-status-generator'
import type { FullProjectContext } from './ai-summarization'

// Minimal valid context
function makeContext(overrides: Partial<FullProjectContext> = {}): FullProjectContext {
  return {
    project: {
      name: 'Case Residence',
      address: '708 Purple Salvia Cove',
      phase: 'Planning',
      currentStep: 4,
      totalSteps: 6,
      startDate: '2025-06-01',
      targetCompletion: '2027-06-01',
      squareFootage: 7526,
      style: 'French Country',
    },
    budget: { total: 1500000, spent: 125000, remaining: 1375000, items: [] },
    planningSteps: [],
    milestones: [],
    tasks: [],
    permits: [],
    contacts: [],
    vendors: [],
    bids: [],
    selections: [],
    communications: [],
    ...overrides,
  }
}

describe('project-status-generator', () => {
  describe('hot topics', () => {
    it('flags blocked milestones', () => {
      const ctx = makeContext({
        milestones: [{ name: 'Grading', description: null, target_date: null, completed_date: null, status: 'blocked', notes: 'Waiting on Arredondo' }],
      })
      const result = generateProjectStatusFromData(ctx)
      expect(result.hot_topics).toHaveLength(1)
      expect(result.hot_topics[0].priority).toBe('high')
      expect(result.hot_topics[0].text).toContain('Grading')
      expect(result.hot_topics[0].text).toContain('Arredondo')
    })

    it('flags overdue tasks', () => {
      const ctx = makeContext({
        tasks: [{ title: 'Submit permit', description: null, due_date: '2026-01-01', priority: 'high', status: 'pending', notes: null }],
      })
      const result = generateProjectStatusFromData(ctx)
      const overdueTopic = result.hot_topics.find(t => t.text.includes('overdue'))
      expect(overdueTopic).toBeDefined()
    })

    it('flags budget overage', () => {
      const ctx = makeContext({
        budget: { total: 1000000, spent: 1100000, remaining: -100000, items: [] },
      })
      const result = generateProjectStatusFromData(ctx)
      const budgetTopic = result.hot_topics.find(t => t.text.includes('Budget over'))
      expect(budgetTopic).toBeDefined()
      expect(budgetTopic!.priority).toBe('high')
    })

    it('flags pending loan', () => {
      const ctx = makeContext({
        loan: {
          id: 'l1', project_id: 'p1', lender_name: 'River Bear', loan_type: 'construction_permanent',
          loan_amount: 830000, application_status: 'submitted',
        },
      })
      const result = generateProjectStatusFromData(ctx)
      const loanTopic = result.hot_topics.find(t => t.text.includes('loan'))
      expect(loanTopic).toBeDefined()
    })

    it('does NOT flag funded loan', () => {
      const ctx = makeContext({
        loan: {
          id: 'l1', project_id: 'p1', lender_name: 'River Bear', loan_type: 'construction_permanent',
          loan_amount: 830000, application_status: 'funded',
        },
      })
      const result = generateProjectStatusFromData(ctx)
      const loanTopic = result.hot_topics.find(t => t.text.includes('loan'))
      expect(loanTopic).toBeUndefined()
    })

    it('returns empty for clean project', () => {
      const ctx = makeContext()
      const result = generateProjectStatusFromData(ctx)
      expect(result.hot_topics).toHaveLength(0)
    })
  })

  describe('action items', () => {
    it('includes pending tasks sorted by priority', () => {
      const ctx = makeContext({
        tasks: [
          { title: 'Low task', description: null, due_date: null, priority: 'low', status: 'pending', notes: null },
          { title: 'High task', description: null, due_date: null, priority: 'high', status: 'pending', notes: null },
        ],
      })
      const result = generateProjectStatusFromData(ctx)
      expect(result.action_items[0].text).toContain('High task')
    })

    it('flags pending bids for review', () => {
      const ctx = makeContext({
        bids: [
          { id: 'b1', vendor_name: 'Vendor A', category: 'Framing', total_amount: 80000, status: 'pending', ai_extracted: false, needs_review: true, bid_date: '2026-03-01', received_date: '2026-03-01' } as any,
        ],
      })
      const result = generateProjectStatusFromData(ctx)
      const bidItem = result.action_items.find(a => a.text.includes('pending bid'))
      expect(bidItem).toBeDefined()
    })

    it('flags categories needing vendor selection', () => {
      const ctx = makeContext({
        bids: [
          { id: 'b1', vendor_name: 'A', category: 'Cabinetry', total_amount: 50000, status: 'pending', ai_extracted: false, needs_review: false, bid_date: '2026-03-01', received_date: '2026-03-01' } as any,
          { id: 'b2', vendor_name: 'B', category: 'Cabinetry', total_amount: 60000, status: 'pending', ai_extracted: false, needs_review: false, bid_date: '2026-03-01', received_date: '2026-03-01' } as any,
        ],
      })
      const result = generateProjectStatusFromData(ctx)
      const selectItem = result.action_items.find(a => a.text.includes('Select vendor'))
      expect(selectItem).toBeDefined()
      expect(selectItem!.text).toContain('Cabinetry')
    })
  })

  describe('recent decisions', () => {
    it('includes recent bid selections', () => {
      const today = new Date().toISOString().split('T')[0]
      const ctx = makeContext({
        bids: [
          { id: 'b1', vendor_name: 'D&D Framing', category: 'Framing', total_amount: 95000, status: 'selected', selection_notes: 'Best value', ai_extracted: false, needs_review: false, bid_date: today, received_date: today } as any,
        ],
      })
      const result = generateProjectStatusFromData(ctx)
      const decision = result.recent_decisions.find(d => d.decision.includes('D&D Framing'))
      expect(decision).toBeDefined()
    })
  })

  describe('next steps', () => {
    it('includes next upcoming milestone', () => {
      const ctx = makeContext({
        milestones: [
          { name: 'Foundation Pour', description: null, target_date: '2026-06-01', completed_date: null, status: 'pending', notes: null },
          { name: 'Framing Start', description: null, target_date: '2026-07-01', completed_date: null, status: 'pending', notes: null },
        ],
      })
      const result = generateProjectStatusFromData(ctx)
      expect(result.next_steps[0]).toContain('Foundation Pour')
    })
  })

  describe('key data points', () => {
    it('includes budget', () => {
      const ctx = makeContext()
      const result = generateProjectStatusFromData(ctx)
      const budget = result.key_data_points.find(p => p.category === 'Budget')
      expect(budget).toBeDefined()
      expect(budget!.data).toContain('$125,000')
    })

    it('includes phase', () => {
      const ctx = makeContext()
      const result = generateProjectStatusFromData(ctx)
      const phase = result.key_data_points.find(p => p.category === 'Phase')
      expect(phase).toBeDefined()
      expect(phase!.data).toContain('Planning')
    })

    it('includes loan when present', () => {
      const ctx = makeContext({
        loan: {
          id: 'l1', project_id: 'p1', lender_name: 'River Bear', loan_type: 'construction_permanent',
          loan_amount: 830000, application_status: 'conditionally_approved',
        },
      })
      const result = generateProjectStatusFromData(ctx)
      const loan = result.key_data_points.find(p => p.category === 'Loan')
      expect(loan).toBeDefined()
      expect(loan!.data).toContain('River Bear')
    })
  })

  describe('summary', () => {
    it('generates coherent narrative', () => {
      const ctx = makeContext()
      const result = generateProjectStatusFromData(ctx)
      expect(result.ai_summary).toContain('Case Residence')
      expect(result.ai_summary).toContain('Planning')
      expect(result.ai_summary).toContain('$125,000')
    })
  })

  describe('full snapshot shape', () => {
    it('returns all required fields', () => {
      const ctx = makeContext()
      const result = generateProjectStatusFromData(ctx)
      expect(result).toHaveProperty('hot_topics')
      expect(result).toHaveProperty('action_items')
      expect(result).toHaveProperty('recent_decisions')
      expect(result).toHaveProperty('next_steps')
      expect(result).toHaveProperty('open_questions')
      expect(result).toHaveProperty('key_data_points')
      expect(result).toHaveProperty('ai_summary')
    })
  })
})
