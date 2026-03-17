import { describe, it, expect } from 'vitest'
import { parseLeadTimeDays, calculateOrderByDate } from './lead-time-utils'

describe('parseLeadTimeDays', () => {
  it('parses week ranges taking maximum', () => {
    expect(parseLeadTimeDays('6-8 weeks')).toBe(56)
    expect(parseLeadTimeDays('2-3 weeks')).toBe(21)
    expect(parseLeadTimeDays('10-12 weeks')).toBe(84)
  })

  it('parses single week values', () => {
    expect(parseLeadTimeDays('12 weeks')).toBe(84)
    expect(parseLeadTimeDays('8 weeks')).toBe(56)
  })

  it('parses day values', () => {
    expect(parseLeadTimeDays('90 days')).toBe(90)
    expect(parseLeadTimeDays('30 days')).toBe(30)
  })

  it('parses day ranges', () => {
    expect(parseLeadTimeDays('30-45 days')).toBe(45)
  })

  it('parses month values', () => {
    expect(parseLeadTimeDays('3 months')).toBe(90)
    expect(parseLeadTimeDays('6 months')).toBe(180)
  })

  it('parses month ranges taking maximum', () => {
    expect(parseLeadTimeDays('4-6 months')).toBe(180)
    expect(parseLeadTimeDays('2-3 months')).toBe(90)
  })

  it('parses abbreviated units', () => {
    expect(parseLeadTimeDays('2-3 wks')).toBe(21)
    expect(parseLeadTimeDays('4 wk')).toBe(28)
  })

  it('handles en-dash and "to" separators', () => {
    expect(parseLeadTimeDays('6–8 weeks')).toBe(56)
    expect(parseLeadTimeDays('6 to 8 weeks')).toBe(56)
  })

  it('returns null for empty/invalid input', () => {
    expect(parseLeadTimeDays('')).toBeNull()
    expect(parseLeadTimeDays('soon')).toBeNull()
    expect(parseLeadTimeDays('TBD')).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(parseLeadTimeDays(null as unknown as string)).toBeNull()
    expect(parseLeadTimeDays(undefined as unknown as string)).toBeNull()
  })
})

describe('calculateOrderByDate', () => {
  it('subtracts lead time from phase start', () => {
    const phaseStart = new Date('2026-06-01')
    const result = calculateOrderByDate(phaseStart, 56) // 8 weeks
    expect(result.toISOString().split('T')[0]).toBe('2026-04-06')
  })

  it('handles zero lead time', () => {
    const phaseStart = new Date('2026-06-01')
    const result = calculateOrderByDate(phaseStart, 0)
    expect(result.toISOString().split('T')[0]).toBe('2026-06-01')
  })
})
