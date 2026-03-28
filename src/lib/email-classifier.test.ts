import { describe, it, expect } from 'vitest'
import { classifyEmail } from './email-classifier'

describe('email-classifier', () => {
  describe('domain-based classification', () => {
    it('classifies UBuildIt emails as construction', () => {
      const r = classifyEmail('aaronm.tx@ubuildit.com', 'Re: Updated framing bid', '')
      expect(r.category).toBe('construction')
      expect(r.confidence).toBeGreaterThanOrEqual(0.95)
    })

    it('classifies KFA emails as construction', () => {
      const r = classifyEmail('matthewb@kippflores.com', 'Plan revision', '')
      expect(r.category).toBe('construction')
    })

    it('classifies Asiri emails as construction', () => {
      const r = classifyEmail('sharif@asiri-designs.com', 'Detail drawings', '')
      expect(r.category).toBe('construction')
    })

    it('classifies River Bear as financial', () => {
      const r = classifyEmail('david@riverbearfinancial.com', 'Loan update', '')
      expect(r.category).toBe('financial')
    })

    it('classifies USAA as legal', () => {
      const r = classifyEmail('claims@usaa.com', 'Claim update', '')
      expect(r.category).toBe('legal')
    })

    it('classifies GitHub as other', () => {
      const r = classifyEmail('notifications@github.com', '[build-ai-home] PR merged', '')
      expect(r.category).toBe('other')
    })

    it('classifies LinkedIn as other', () => {
      const r = classifyEmail('messages-noreply@linkedin.com', 'New connection', '')
      expect(r.category).toBe('other')
    })

    it('classifies Stripe as other', () => {
      const r = classifyEmail('receipts@stripe.com', 'Payment receipt', '')
      expect(r.category).toBe('other')
    })

    it('classifies noreply addresses as other', () => {
      const r = classifyEmail('noreply@someservice.com', 'Account update', '')
      expect(r.category).toBe('other')
    })
  })

  describe('keyword-based classification', () => {
    it('classifies bid-related subjects as construction', () => {
      const r = classifyEmail('unknown@vendor.com', 'Updated bid for framing lumber', '')
      expect(r.category).toBe('construction')
    })

    it('classifies permit subjects as construction', () => {
      const r = classifyEmail('permits@wilco.org', 'Building permit approval', '')
      expect(r.category).toBe('construction')
    })

    it('classifies loan subjects as financial', () => {
      const r = classifyEmail('unknown@bank.com', 'Construction loan pre-approval', '')
      expect(r.category).toBe('financial')
    })

    it('classifies insurance claim subjects as legal', () => {
      const r = classifyEmail('unknown@insurer.com', 'Insurance claim update', '')
      expect(r.category).toBe('legal')
    })

    it('classifies unsubscribe emails as other', () => {
      const r = classifyEmail('marketing@random.com', 'Great deals this week', 'unsubscribe from this list')
      expect(r.category).toBe('other')
    })

    it('classifies shipping notifications as other', () => {
      const r = classifyEmail('ship@ups.com', 'Your delivery update', 'tracking number 1Z999...')
      expect(r.category).toBe('other')
    })
  })

  describe('known contacts', () => {
    it('classifies known contact emails as construction', () => {
      const contacts = new Set(['randy@windyhillcabinets.com'])
      const r = classifyEmail('randy@windyhillcabinets.com', 'Checking in', '', contacts)
      expect(r.category).toBe('construction')
      expect(r.rule).toBe('known_contact')
    })

    it('does not override noise domains with contact match', () => {
      const contacts = new Set(['notifications@github.com'])
      const r = classifyEmail('notifications@github.com', 'PR review', '', contacts)
      expect(r.category).toBe('other') // noise domain takes priority
    })
  })

  describe('body keyword fallback', () => {
    it('classifies by body when subject is generic', () => {
      const r = classifyEmail('someone@custom.com', 'Quick update', 'The cabinet bid is attached')
      expect(r.category).toBe('construction')
      expect(r.confidence).toBeLessThan(0.8) // lower confidence for body match
    })
  })

  describe('default classification', () => {
    it('returns other with low confidence for unknown emails', () => {
      const r = classifyEmail('random@unknown.com', 'Hello', 'Just wanted to say hi')
      expect(r.category).toBe('other')
      expect(r.confidence).toBe(0.50)
      expect(r.rule).toBe('default')
    })
  })

  describe('edge cases', () => {
    it('handles empty sender', () => {
      const r = classifyEmail('', 'Test', '')
      expect(r.category).toBe('other')
    })

    it('handles construction keywords in both subject and noise in body', () => {
      // Subject has construction keyword — should classify as construction
      const r = classifyEmail('vendor@custom.com', 'Updated framing bid', 'click here to unsubscribe')
      expect(r.category).toBe('construction')
    })

    it('prioritizes noise over body-only construction keywords', () => {
      // No construction keywords in subject, noise keywords present
      const r = classifyEmail('promo@random.com', 'Special offer', 'great deals on lumber this week unsubscribe')
      expect(r.category).toBe('other')
    })
  })
})
