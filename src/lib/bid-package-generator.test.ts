import { describe, it, expect } from 'vitest'
import { generateSOW, generateOutreachEmail } from './bid-package-generator'
import type { TakeoffItem } from '@/types'

const sampleItems: TakeoffItem[] = [
  {
    id: 'item-1',
    takeoff_run_id: 'run-1',
    project_id: 'proj-1',
    category: 'wall_framing',
    subcategory: 'exterior_walls',
    trade: 'framing',
    item_name: '2x8 T-Stud 10ft',
    material_spec: 'Thermal Stud',
    quantity: 450,
    unit: 'EA',
    waste_factor: 0.05,
    quantity_with_waste: 472.5,
    source: 'calculated',
    confidence: 'calculated',
  },
  {
    id: 'item-2',
    takeoff_run_id: 'run-1',
    project_id: 'proj-1',
    category: 'wall_framing',
    subcategory: 'interior_walls',
    trade: 'framing',
    item_name: '2x6 Stud 10ft',
    material_spec: 'SPF #2',
    quantity: 600,
    unit: 'EA',
    waste_factor: 0.05,
    quantity_with_waste: 630,
    source: 'calculated',
    confidence: 'estimated',
  },
  {
    id: 'item-3',
    takeoff_run_id: 'run-1',
    project_id: 'proj-1',
    category: 'sheathing',
    trade: 'framing',
    item_name: 'ZIP System 4x8 Sheet',
    material_spec: 'Huber ZIP 7/16',
    quantity: 280,
    unit: 'sheets',
    waste_factor: 0.10,
    quantity_with_waste: 308,
    source: 'calculated',
    confidence: 'calculated',
  },
  {
    id: 'item-4',
    takeoff_run_id: 'run-1',
    project_id: 'proj-1',
    category: 'roof_framing',
    trade: 'framing',
    item_name: 'Ridge beam LVL',
    quantity: 1,
    unit: 'EA',
    confidence: 'gap',
    source: 'estimated',
  },
]

describe('bid-package-generator', () => {
  describe('generateSOW', () => {
    it('generates a complete SOW with all sections', () => {
      const sow = generateSOW('Framing Lumber Supply', 'Framing Package', sampleItems, {
        deadline: '2026-04-15',
        ownerFurnished: ['Structural steel beams and columns'],
        exclusions: ['Foundation work', 'Roofing installation'],
      })

      expect(sow.trade).toBe('Framing Lumber Supply')
      expect(sow.title).toBe('Framing Package')
      expect(sow.itemCount).toBe(4)
      expect(sow.sections.length).toBeGreaterThan(5)
    })

    it('includes project address in header', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems)
      expect(sow.fullText).toContain('708 Purple Salvia Cove')
      expect(sow.fullText).toContain('Daniel Case')
    })

    it('groups items by category in quantities section', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems)
      expect(sow.fullText).toContain('WALL_FRAMING — EXTERIOR_WALLS')
      expect(sow.fullText).toContain('WALL_FRAMING — INTERIOR_WALLS')
      expect(sow.fullText).toContain('SHEATHING')
      expect(sow.fullText).toContain('ROOF_FRAMING')
    })

    it('includes material specs in quantity lines', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems)
      expect(sow.fullText).toContain('Thermal Stud')
      expect(sow.fullText).toContain('SPF #2')
      expect(sow.fullText).toContain('Huber ZIP 7/16')
    })

    it('uses quantity_with_waste when available', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems)
      expect(sow.fullText).toContain('472.5 EA') // 450 * 1.05
      expect(sow.fullText).toContain('308 sheets') // 280 * 1.10
    })

    it('marks gap items with [VERIFY]', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems)
      expect(sow.fullText).toContain('[VERIFY]')
    })

    it('includes owner-furnished items when provided', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems, {
        ownerFurnished: ['Steel beams'],
      })
      expect(sow.fullText).toContain('OWNER-FURNISHED')
      expect(sow.fullText).toContain('Steel beams')
    })

    it('includes bid deadline when provided', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems, {
        deadline: '2026-04-15',
      })
      expect(sow.fullText).toContain('2026-04-15')
      expect(sow.fullText).toContain('BID DUE DATE')
    })

    it('omits optional sections when not provided', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems)
      expect(sow.fullText).not.toContain('OWNER-FURNISHED')
      expect(sow.fullText).not.toContain('NOT IN SCOPE')
      expect(sow.fullText).not.toContain('ADDITIONAL NOTES')
    })

    it('includes insurance and evaluation criteria', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems)
      expect(sow.fullText).toContain('General Liability')
      expect(sow.fullText).toContain('Workers Compensation')
      expect(sow.fullText).toContain('Lowest bid is NOT automatically selected')
    })
  })

  describe('generateOutreachEmail', () => {
    it('generates a properly formatted outreach email', () => {
      const sow = generateSOW('Framing Lumber', 'Framing Package', sampleItems)
      const email = generateOutreachEmail(
        { name: '84 Lumber', contactName: 'Mike', email: 'mike@84lumber.com' },
        sow,
        'pkg-1',
        '2026-04-15'
      )

      expect(email.to).toBe('mike@84lumber.com')
      expect(email.toName).toBe('Mike')
      expect(email.subject).toContain('Bid Request')
      expect(email.subject).toContain('Case Residence')
      expect(email.bodyHtml).toContain('Hi Mike')
      expect(email.bodyHtml).toContain('Liberty Hill, TX')
      expect(email.bodyHtml).toContain('7,526 sq ft')
      expect(email.bodyHtml).toContain(`${sampleItems.length} line items`)
      expect(email.bodyHtml).toContain('2026-04-15')
    })

    it('omits deadline when not provided', () => {
      const sow = generateSOW('Framing', 'Test', sampleItems)
      const email = generateOutreachEmail(
        { name: 'Test', contactName: 'Bob', email: 'bob@test.com' },
        sow,
        'pkg-1'
      )
      expect(email.bodyHtml).not.toContain('Bid Due Date')
    })
  })
})
