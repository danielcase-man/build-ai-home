import { describe, it, expect } from 'vitest'
import { CONSTRUCTION_PHASES, getAllTrades, getAllBidCategories } from './construction-phases'

describe('CONSTRUCTION_PHASES', () => {
  it('has 8 phases', () => {
    expect(CONSTRUCTION_PHASES).toHaveLength(8)
  })

  it('phases are numbered 1-8', () => {
    const numbers = CONSTRUCTION_PHASES.map(p => p.phase)
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('each phase has trades array', () => {
    for (const phase of CONSTRUCTION_PHASES) {
      expect(Array.isArray(phase.trades)).toBe(true)
      expect(phase.trades.length).toBeGreaterThan(0)
    }
  })
})

describe('getAllTrades', () => {
  it('returns flat list of all trades', () => {
    const trades = getAllTrades()
    expect(trades.length).toBeGreaterThan(20)
  })

  it('each trade has phaseName and phaseNumber', () => {
    const trades = getAllTrades()
    for (const trade of trades) {
      expect(trade).toHaveProperty('phaseName')
      expect(trade).toHaveProperty('phaseNumber')
      expect(trade).toHaveProperty('bidCategory')
    }
  })
})

describe('getAllBidCategories', () => {
  it('returns list of bid category strings', () => {
    const categories = getAllBidCategories()
    expect(categories.length).toBeGreaterThan(0)
    expect(typeof categories[0]).toBe('string')
  })

  it('includes known categories', () => {
    const categories = getAllBidCategories()
    expect(categories).toContain('Foundation')
    expect(categories).toContain('Framing')
    expect(categories).toContain('HVAC')
  })
})
