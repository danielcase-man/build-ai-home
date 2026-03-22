import { describe, it, expect } from 'vitest'
import {
  PHASE_SEQUENCE,
  LEAD_TIME_ITEMS,
  RED_FLAGS,
  getAssistantExpertise,
  getStatusReportExpertise,
  getEmailTriageExpertise,
} from './construction-expertise'

describe('construction-expertise', () => {
  // -------------------------------------------------------------------
  // Static data
  // -------------------------------------------------------------------

  describe('PHASE_SEQUENCE', () => {
    it('has 16 construction phases', () => {
      expect(PHASE_SEQUENCE).toHaveLength(16)
    })

    it('starts with Site Preparation and ends with Punch List & CO', () => {
      expect(PHASE_SEQUENCE[0].name).toContain('Site Preparation')
      expect(PHASE_SEQUENCE[15].name).toContain('Punch List')
    })

    it('marks critical path phases correctly', () => {
      const criticalPhases = PHASE_SEQUENCE.filter(p => p.criticalPath)
      const nonCritical = PHASE_SEQUENCE.filter(p => !p.criticalPath)

      // Most phases are on critical path
      expect(criticalPhases.length).toBeGreaterThan(10)
      // Windows, Exterior Cladding, and Landscaping are off critical path
      expect(nonCritical.length).toBe(3)
      expect(nonCritical.map(p => p.phase)).toEqual(
        expect.arrayContaining([6, 8, 15])
      )
    })

    it('has duration estimates for every phase', () => {
      for (const phase of PHASE_SEQUENCE) {
        expect(phase.duration).toMatch(/\d+-\d+ wk/)
      }
    })
  })

  describe('LEAD_TIME_ITEMS', () => {
    it('has lead time entries for key long-lead items', () => {
      expect(LEAD_TIME_ITEMS.length).toBeGreaterThanOrEqual(5)
    })

    it('includes windows and cabinets with 8+ week lead times', () => {
      const windows = LEAD_TIME_ITEMS.find(l => l.item.toLowerCase().includes('window'))
      const cabinets = LEAD_TIME_ITEMS.find(l => l.item.toLowerCase().includes('cabinet'))

      expect(windows).toBeDefined()
      expect(cabinets).toBeDefined()
      expect(windows!.weeks).toContain('8')
      expect(cabinets!.weeks).toContain('8')
    })

    it('each item has an orderBy milestone', () => {
      for (const item of LEAD_TIME_ITEMS) {
        expect(item.orderBy).toBeTruthy()
      }
    })
  })

  describe('RED_FLAGS', () => {
    it('has four categories of red flags', () => {
      expect(RED_FLAGS.schedule).toBeDefined()
      expect(RED_FLAGS.financial).toBeDefined()
      expect(RED_FLAGS.quality).toBeDefined()
      expect(RED_FLAGS.communication).toBeDefined()
    })

    it('has multiple flags per category', () => {
      expect(RED_FLAGS.schedule.length).toBeGreaterThanOrEqual(3)
      expect(RED_FLAGS.financial.length).toBeGreaterThanOrEqual(3)
      expect(RED_FLAGS.quality.length).toBeGreaterThanOrEqual(3)
      expect(RED_FLAGS.communication.length).toBeGreaterThanOrEqual(2)
    })
  })

  // -------------------------------------------------------------------
  // Expertise generators
  // -------------------------------------------------------------------

  describe('getAssistantExpertise', () => {
    it('returns a string with critical construction knowledge', () => {
      const expertise = getAssistantExpertise()

      expect(typeof expertise).toBe('string')
      expect(expertise.length).toBeGreaterThan(500)
    })

    it('includes critical path information', () => {
      const expertise = getAssistantExpertise()

      expect(expertise).toContain('CRITICAL PATH')
      expect(expertise).toContain('Foundation')
      expect(expertise).toContain('Framing')
      expect(expertise).toContain('MEP Rough-In')
    })

    it('includes lead time alerts', () => {
      const expertise = getAssistantExpertise()

      expect(expertise).toContain('LEAD TIME')
      expect(expertise).toContain('windows')
      expect(expertise).toContain('8-14')
    })

    it('includes bid evaluation rules', () => {
      const expertise = getAssistantExpertise()

      expect(expertise).toContain('BID EVALUATION')
      expect(expertise).toContain('20%')
      expect(expertise).toContain('red flag')
    })

    it('includes Texas-specific climate context', () => {
      const expertise = getAssistantExpertise()

      expect(expertise).toContain('Central Texas')
      expect(expertise).toContain('clay soil')
      expect(expertise).toContain('ACH50')
    })

    it('includes project-specific context', () => {
      const expertise = getAssistantExpertise()

      expect(expertise).toContain('7,571')
      expect(expertise).toContain('French Country')
      expect(expertise).toContain('ASIRI')
      expect(expertise).toContain('UBuildIt')
    })

    it('includes change order discipline', () => {
      const expertise = getAssistantExpertise()

      expect(expertise).toContain('CHANGE ORDER')
      expect(expertise).toContain('Stop, price, approve')
    })

    it('includes owner-builder risk awareness', () => {
      const expertise = getAssistantExpertise()

      expect(expertise).toContain('OWNER-BUILDER')
      expect(expertise).toContain('delayed selections')
    })
  })

  describe('getStatusReportExpertise', () => {
    it('returns analysis-focused expertise', () => {
      const expertise = getStatusReportExpertise()

      expect(typeof expertise).toBe('string')
      expect(expertise.length).toBeGreaterThan(200)
    })

    it('includes email signal detection guidance', () => {
      const expertise = getStatusReportExpertise()

      expect(expertise).toContain('CRITICAL PATH IMPACT')
      expect(expertise).toContain('SELECTION DEADLINES')
      expect(expertise).toContain('UNRESPONSIVE SUBS')
      expect(expertise).toContain('INSPECTION RESULTS')
      expect(expertise).toContain('BUDGET SIGNALS')
      expect(expertise).toContain('LOAN STATUS')
    })

    it('includes priority classification rules', () => {
      const expertise = getStatusReportExpertise()

      expect(expertise).toContain('HIGH')
      expect(expertise).toContain('MEDIUM')
      expect(expertise).toContain('LOW')
    })
  })

  describe('getEmailTriageExpertise', () => {
    it('returns email-focused expertise', () => {
      const expertise = getEmailTriageExpertise()

      expect(typeof expertise).toBe('string')
      expect(expertise.length).toBeGreaterThan(200)
    })

    it('includes urgency assessment guidance', () => {
      const expertise = getEmailTriageExpertise()

      expect(expertise).toContain('URGENCY')
      expect(expertise).toContain('CRITICAL PATH')
      expect(expertise).toContain('LENDER')
    })

    it('includes construction-specific patterns to recognize', () => {
      const expertise = getEmailTriageExpertise()

      expect(expertise).toContain('bid')
      expect(expertise).toContain('estimate')
      expect(expertise).toContain('Lien waiver')
      expect(expertise).toContain('inspector')
    })
  })
})
