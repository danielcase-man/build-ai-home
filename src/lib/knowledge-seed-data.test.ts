import { describe, it, expect } from 'vitest'
import { KNOWLEDGE_SEED_DATA } from './knowledge-seed-data'

describe('Knowledge Seed Data', () => {
  it('covers all 8 construction phases', () => {
    const phases = new Set(KNOWLEDGE_SEED_DATA.map(item => item.phase_number))
    expect(phases.size).toBe(8)
    for (let i = 1; i <= 8; i++) {
      expect(phases.has(i)).toBe(true)
    }
  })

  it('has valid item types', () => {
    const validTypes = new Set(['task', 'material', 'inspection', 'decision_point'])

    function checkItem(item: { item_type: string; children?: Array<{ item_type: string; children?: unknown[] }> }) {
      expect(validTypes.has(item.item_type)).toBe(true)
      if (item.children) {
        for (const child of item.children) {
          checkItem(child as typeof item)
        }
      }
    }

    for (const item of KNOWLEDGE_SEED_DATA) {
      checkItem(item)
    }
  })

  it('has sort_order on all items', () => {
    function checkSortOrder(item: { sort_order: number; children?: Array<{ sort_order: number }> }) {
      expect(typeof item.sort_order).toBe('number')
      expect(item.sort_order).toBeGreaterThan(0)
      if (item.children) {
        for (const child of item.children) {
          checkSortOrder(child as typeof item)
        }
      }
    }

    for (const item of KNOWLEDGE_SEED_DATA) {
      checkSortOrder(item)
    }
  })

  it('has at least 25 top-level trade items', () => {
    expect(KNOWLEDGE_SEED_DATA.length).toBeGreaterThanOrEqual(25)
  })

  it('decision_point items with decision_options have non-empty options', () => {
    function checkDecisions(item: { item_type: string; decision_required?: boolean; decision_options?: unknown[]; children?: Array<typeof item> }) {
      if (item.decision_options) {
        expect(item.decision_options.length).toBeGreaterThan(0)
      }
      if (item.children) {
        for (const child of item.children) {
          checkDecisions(child as typeof item)
        }
      }
    }

    for (const item of KNOWLEDGE_SEED_DATA) {
      checkDecisions(item)
    }
  })

  it('has multiple decision points requiring decisions', () => {
    let decisionCount = 0
    function countDecisions(item: { decision_required?: boolean; children?: Array<typeof item> }) {
      if (item.decision_required) decisionCount++
      if (item.children) {
        for (const child of item.children) {
          countDecisions(child as typeof item)
        }
      }
    }

    for (const item of KNOWLEDGE_SEED_DATA) {
      countDecisions(item)
    }

    expect(decisionCount).toBeGreaterThanOrEqual(20)
  })

  it('inspection items have inspection_required set', () => {
    function checkInspections(item: { item_type: string; inspection_required?: boolean; children?: Array<typeof item> }) {
      if (item.item_type === 'inspection') {
        expect(item.inspection_required).toBe(true)
      }
      if (item.children) {
        for (const child of item.children) {
          checkInspections(child as typeof item)
        }
      }
    }

    for (const item of KNOWLEDGE_SEED_DATA) {
      checkInspections(item)
    }
  })

  it('all items have trade and phase_number', () => {
    for (const item of KNOWLEDGE_SEED_DATA) {
      expect(item.trade).toBeTruthy()
      expect(item.phase_number).toBeGreaterThanOrEqual(1)
      expect(item.phase_number).toBeLessThanOrEqual(8)
    }
  })

  it('has at least 80 total items including children', () => {
    let count = 0
    for (const item of KNOWLEDGE_SEED_DATA) {
      count++
      if (item.children) {
        count += item.children.length
      }
    }
    expect(count).toBeGreaterThanOrEqual(80)
  })
})
