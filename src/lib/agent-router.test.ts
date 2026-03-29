import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classifyFileByPath, classifyEmail, dispatchToAgents, registerAgent, summarizeEvents } from './agent-router'
import type { ChangeEvent, AgentResult } from '@/types'

describe('agent-router', () => {
  describe('classifyFileByPath', () => {
    it('classifies files in Bids/ as bid_analysis', () => {
      expect(classifyFileByPath('/Dropbox/Bids/Cabinets/quote.pdf', 'quote.pdf')).toBe('bid_analysis')
      expect(classifyFileByPath('/Dropbox/Bids/Appliances/FBS/Quote 410012.pdf', 'Quote 410012.pdf')).toBe('bid_analysis')
    })

    it('classifies files in Engineering Plans/ as takeoff', () => {
      expect(classifyFileByPath('/Dropbox/Engineering Plans/foundation.pdf', 'foundation.pdf')).toBe('takeoff')
    })

    it('classifies files in Plans/ as takeoff', () => {
      expect(classifyFileByPath('/Dropbox/Plans/floor_plan.pdf', 'floor_plan.pdf')).toBe('takeoff')
    })

    it('classifies files in Financial/ as financial', () => {
      expect(classifyFileByPath('/Dropbox/Financial/Q1_expenses.csv', 'Q1_expenses.csv')).toBe('financial')
    })

    it('classifies files in Receipts/ as financial', () => {
      expect(classifyFileByPath('/Dropbox/Bids/Receipts/VTReceipt.pdf', 'VTReceipt.pdf')).toBe('financial')
    })

    it('classifies files in Contracts/ as contract', () => {
      expect(classifyFileByPath('/Dropbox/Contracts/WCG_agreement.pdf', 'WCG_agreement.pdf')).toBe('contract')
    })

    it('uses filename patterns when path is ambiguous', () => {
      expect(classifyFileByPath('/Dropbox/misc/bid_for_framing.pdf', 'bid_for_framing.pdf')).toBe('bid_analysis')
      expect(classifyFileByPath('/Dropbox/misc/invoice_march.pdf', 'invoice_march.pdf')).toBe('financial')
    })

    it('returns general for unclassifiable files', () => {
      expect(classifyFileByPath('/Dropbox/Photos/site.jpg', 'site.jpg')).toBe('general')
    })

    it('classifies DXF files as takeoff', () => {
      expect(classifyFileByPath('/Dropbox/misc/plan.dxf', 'plan.dxf')).toBe('takeoff')
    })

    it('classifies Final Budget folder as financial', () => {
      expect(classifyFileByPath('/Dropbox/Bids/Final Budget/budget.xlsx', 'budget.xlsx')).toBe('financial')
    })
  })

  describe('classifyEmail', () => {
    it('classifies bid-related subjects', () => {
      expect(classifyEmail('Updated bid for framing', 'vendor@example.com')).toBe('bid_analysis')
      expect(classifyEmail('Quote for cabinets', 'vendor@example.com')).toBe('bid_analysis')
      expect(classifyEmail('Pricing update', 'vendor@example.com')).toBe('bid_analysis')
    })

    it('classifies follow-up subjects', () => {
      expect(classifyEmail('Following up on our proposal', 'vendor@example.com')).toBe('follow_up')
      expect(classifyEmail('Checking in on cabinet order', 'vendor@example.com')).toBe('follow_up')
    })

    it('classifies financial subjects', () => {
      expect(classifyEmail('Invoice #1234', 'vendor@example.com')).toBe('financial')
      expect(classifyEmail('Draw schedule update', 'lender@bank.com')).toBe('financial')
      expect(classifyEmail('Loan approval notification', 'lender@bank.com')).toBe('financial')
    })

    it('classifies scheduling subjects', () => {
      expect(classifyEmail('Updated construction schedule', 'gc@example.com')).toBe('scheduling')
      expect(classifyEmail('Inspection passed', 'inspector@county.gov')).toBe('scheduling')
    })

    it('classifies contract subjects', () => {
      expect(classifyEmail('Contract for review', 'attorney@law.com')).toBe('contract')
      expect(classifyEmail('Please sign the agreement', 'vendor@example.com')).toBe('contract')
    })

    it('returns general for unclassifiable subjects', () => {
      expect(classifyEmail('Hello!', 'friend@example.com')).toBe('general')
    })
  })

  describe('dispatchToAgents', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('dispatches events to registered handlers', async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        domain: 'bid_analysis',
        source: 'dropbox',
        action: 'processed',
        details: 'Processed 3 files',
        records_created: 3,
        records_updated: 0,
        errors: [],
        duration_ms: 0,
      } satisfies AgentResult)

      registerAgent('bid_analysis', mockHandler)

      const events: ChangeEvent[] = [
        { source: 'dropbox', domain: 'bid_analysis', file_path: '/a.pdf', file_name: 'a.pdf', detected_at: '2026-03-29' },
        { source: 'dropbox', domain: 'bid_analysis', file_path: '/b.pdf', file_name: 'b.pdf', detected_at: '2026-03-29' },
      ]

      const results = await dispatchToAgents(events, 'proj-001')
      expect(results).toHaveLength(1)
      expect(results[0].records_created).toBe(3)
      expect(mockHandler).toHaveBeenCalledWith(events, 'proj-001')
    })

    it('returns skipped result for unregistered domains', async () => {
      const events: ChangeEvent[] = [
        { source: 'gmail', domain: 'scheduling', detected_at: '2026-03-29' },
      ]

      const results = await dispatchToAgents(events, 'proj-001')
      expect(results).toHaveLength(1)
      expect(results[0].action).toBe('skipped')
      expect(results[0].details).toContain('No agent registered')
    })

    it('handles agent crashes gracefully', async () => {
      registerAgent('financial', async () => { throw new Error('Agent crashed') })

      const events: ChangeEvent[] = [
        { source: 'dropbox', domain: 'financial', detected_at: '2026-03-29' },
      ]

      const results = await dispatchToAgents(events, 'proj-001')
      expect(results).toHaveLength(1)
      expect(results[0].action).toBe('failed')
      expect(results[0].errors).toContain('Agent crashed')
    })

    it('groups events by domain before dispatching', async () => {
      const bidHandler = vi.fn().mockResolvedValue({
        domain: 'bid_analysis', source: 'dropbox', action: 'ok',
        details: '', records_created: 0, records_updated: 0, errors: [], duration_ms: 0,
      })
      registerAgent('bid_analysis', bidHandler)

      const events: ChangeEvent[] = [
        { source: 'dropbox', domain: 'bid_analysis', file_name: 'a.pdf', detected_at: '2026-03-29' },
        { source: 'gmail', domain: 'follow_up', detected_at: '2026-03-29' },
        { source: 'dropbox', domain: 'bid_analysis', file_name: 'b.pdf', detected_at: '2026-03-29' },
      ]

      await dispatchToAgents(events, 'proj-001')

      // bid_analysis handler gets 2 events
      expect(bidHandler).toHaveBeenCalledTimes(1)
      expect(bidHandler.mock.calls[0][0]).toHaveLength(2)
    })
  })

  describe('summarizeEvents', () => {
    it('counts events by domain', () => {
      const events: ChangeEvent[] = [
        { source: 'dropbox', domain: 'bid_analysis', detected_at: '2026-03-29' },
        { source: 'dropbox', domain: 'bid_analysis', detected_at: '2026-03-29' },
        { source: 'gmail', domain: 'follow_up', detected_at: '2026-03-29' },
        { source: 'dropbox', domain: 'financial', detected_at: '2026-03-29' },
      ]

      const summary = summarizeEvents(events)
      expect(summary.bid_analysis).toBe(2)
      expect(summary.follow_up).toBe(1)
      expect(summary.financial).toBe(1)
    })
  })
})
