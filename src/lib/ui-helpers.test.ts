import { describe, it, expect } from 'vitest'
import { extractEmailAddress, extractSenderName, getPriorityColor, getImportanceBadge, formatEmailDate } from './ui-helpers'

describe('extractEmailAddress', () => {
  it('extracts email from "Name <email>" format', () => {
    expect(extractEmailAddress('John Doe <john@example.com>')).toBe('john@example.com')
  })

  it('handles quoted name with angle brackets', () => {
    expect(extractEmailAddress('"John Doe" <john@example.com>')).toBe('john@example.com')
  })

  it('returns bare email as-is', () => {
    expect(extractEmailAddress('john@example.com')).toBe('john@example.com')
  })

  it('returns empty string as-is', () => {
    expect(extractEmailAddress('')).toBe('')
  })
})

describe('extractSenderName', () => {
  it('extracts name from "Name <email>" format', () => {
    expect(extractSenderName('John Doe <john@example.com>')).toBe('John Doe')
  })

  it('strips quotes from name', () => {
    expect(extractSenderName('"John Doe" <john@example.com>')).toBe('John Doe')
  })

  it('returns bare email as-is when no angle brackets', () => {
    expect(extractSenderName('john@example.com')).toBe('john@example.com')
  })

  it('returns empty string as-is', () => {
    expect(extractSenderName('')).toBe('')
  })
})

describe('getPriorityColor', () => {
  it('returns red classes for critical', () => {
    expect(getPriorityColor('critical')).toContain('red')
  })

  it('returns orange classes for high', () => {
    expect(getPriorityColor('high')).toContain('orange')
  })

  it('returns yellow classes for medium', () => {
    expect(getPriorityColor('medium')).toContain('yellow')
  })

  it('returns green classes for low', () => {
    expect(getPriorityColor('low')).toContain('green')
  })

  it('returns gray classes for unknown priority', () => {
    expect(getPriorityColor('unknown')).toContain('gray')
  })
})

describe('getImportanceBadge', () => {
  it('returns filled circle for critical', () => {
    expect(getImportanceBadge('critical')).toBe('●')
  })

  it('returns diamond for important', () => {
    expect(getImportanceBadge('important')).toBe('◆')
  })

  it('returns open circle for info', () => {
    expect(getImportanceBadge('info')).toBe('○')
  })

  it('returns dot for unknown', () => {
    expect(getImportanceBadge('other')).toBe('·')
  })
})

describe('formatEmailDate', () => {
  it('formats valid date string', () => {
    const result = formatEmailDate('2026-01-15T10:30:00Z')
    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2026')
  })

  it('returns original string for invalid date', () => {
    expect(formatEmailDate('not-a-date')).toBe('not-a-date')
  })
})
