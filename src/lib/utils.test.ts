import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  getDaysRemaining,
  getProgressPercentage,
  isValidEmail,
  isValidPhone,
  formatPhone,
  truncateText,
  slugify,
  isEmpty,
  safeJsonParse,
  calculatePercentage,
  formatPercentage,
  getInitials,
  generateColor,
  calculateBusinessDays,
  getStatusColor,
  formatFileSize,
  construction,
  PerformanceTimer,
} from './utils'

// ─── cn ─────────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('merges tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'text-sm')).toBe('base text-sm')
  })
})

// ─── formatCurrency ─────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(85000)).toBe('$85,000')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-1500)).toBe('-$1,500')
  })
})

// ─── formatDate ─────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats date with long format by default', () => {
    // Use full ISO string to avoid timezone ambiguity
    const result = formatDate('2026-01-15T12:00:00')
    expect(result).toContain('January')
    expect(result).toContain('15')
    expect(result).toContain('2026')
  })

  it('formats date with short format', () => {
    const result = formatDate('2026-01-15T12:00:00', 'short')
    expect(result).toMatch(/1\/15\/26/)
  })

  it('formats date with medium format', () => {
    const result = formatDate('2026-01-15T12:00:00', 'medium')
    expect(result).toContain('Jan')
  })

  it('delegates to formatRelativeTime for relative format', () => {
    const result = formatDate(new Date(), 'relative')
    expect(result).toBe('just now')
  })
})

// ─── formatRelativeTime ─────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "just now" for recent times', () => {
    expect(formatRelativeTime(new Date())).toBe('just now')
  })

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    expect(formatRelativeTime(fiveMinAgo)).toBe('5 minutes ago')
  })

  it('returns singular minute', () => {
    const oneMinAgo = new Date(Date.now() - 60 * 1000)
    expect(formatRelativeTime(oneMinAgo)).toBe('1 minute ago')
  })

  it('returns hours ago', () => {
    const twoHrsAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    expect(formatRelativeTime(twoHrsAgo)).toBe('2 hours ago')
  })

  it('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago')
  })
})

// ─── getDaysRemaining ───────────────────────────────────────────────────────

describe('getDaysRemaining', () => {
  it('returns remaining days', () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 10)
    expect(getDaysRemaining(startDate, 30)).toBe(20)
  })

  it('never returns negative', () => {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 100)
    expect(getDaysRemaining(startDate, 30)).toBe(0)
  })
})

// ─── getProgressPercentage ──────────────────────────────────────────────────

describe('getProgressPercentage', () => {
  it('calculates percentage', () => {
    expect(getProgressPercentage(3, 6)).toBe(50)
  })

  it('rounds to nearest integer', () => {
    expect(getProgressPercentage(1, 3)).toBe(33)
  })
})

// ─── isValidEmail ───────────────────────────────────────────────────────────

describe('isValidEmail', () => {
  it('accepts valid email', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
  })

  it('rejects email without @', () => {
    expect(isValidEmail('testexample.com')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})

// ─── isValidPhone / formatPhone ─────────────────────────────────────────────

describe('isValidPhone', () => {
  it('accepts 10-digit phone', () => {
    expect(isValidPhone('5128283187')).toBe(true)
  })

  it('accepts formatted phone', () => {
    expect(isValidPhone('(512) 828-3187')).toBe(true)
  })

  it('rejects short number', () => {
    expect(isValidPhone('12345')).toBe(false)
  })
})

describe('formatPhone', () => {
  it('formats 10-digit number', () => {
    expect(formatPhone('5128283187')).toBe('(512) 828-3187')
  })

  it('formats 11-digit number with country code', () => {
    expect(formatPhone('15128283187')).toBe('+1 (512) 828-3187')
  })

  it('returns original for other lengths', () => {
    expect(formatPhone('123')).toBe('123')
  })
})

// ─── truncateText ───────────────────────────────────────────────────────────

describe('truncateText', () => {
  it('returns text unchanged when short enough', () => {
    expect(truncateText('hello', 10)).toBe('hello')
  })

  it('truncates with ellipsis', () => {
    expect(truncateText('hello world this is long', 10)).toBe('hello w...')
  })
})

// ─── slugify ────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converts to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Foundation & Concrete!')).toBe('foundation-concrete')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugify('--test--')).toBe('test')
  })
})

// ─── isEmpty ────────────────────────────────────────────────────────────────

describe('isEmpty', () => {
  it('returns true for null', () => { expect(isEmpty(null)).toBe(true) })
  it('returns true for undefined', () => { expect(isEmpty(undefined)).toBe(true) })
  it('returns true for empty string', () => { expect(isEmpty('')).toBe(true) })
  it('returns true for whitespace', () => { expect(isEmpty('   ')).toBe(true) })
  it('returns true for empty array', () => { expect(isEmpty([])).toBe(true) })
  it('returns true for empty object', () => { expect(isEmpty({})).toBe(true) })
  it('returns false for non-empty string', () => { expect(isEmpty('a')).toBe(false) })
  it('returns false for non-empty array', () => { expect(isEmpty([1])).toBe(false) })
  it('returns false for number', () => { expect(isEmpty(0)).toBe(false) })
})

// ─── safeJsonParse ──────────────────────────────────────────────────────────

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 })
  })

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('not json', 'fallback')).toBe('fallback')
  })
})

// ─── calculatePercentage / formatPercentage ─────────────────────────────────

describe('calculatePercentage', () => {
  it('returns 0 when total is 0', () => {
    expect(calculatePercentage(5, 0)).toBe(0)
  })

  it('caps at 100', () => {
    expect(calculatePercentage(150, 100)).toBe(100)
  })

  it('does not go below 0', () => {
    expect(calculatePercentage(-10, 100)).toBe(0)
  })
})

describe('formatPercentage', () => {
  it('formats with default decimals', () => {
    expect(formatPercentage(45.678)).toBe('45.7%')
  })

  it('formats with custom decimals', () => {
    expect(formatPercentage(45.678, 2)).toBe('45.68%')
  })
})

// ─── getInitials ────────────────────────────────────────────────────────────

describe('getInitials', () => {
  it('extracts initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('handles single name', () => {
    expect(getInitials('John')).toBe('J')
  })

  it('caps at 2 characters', () => {
    expect(getInitials('John Michael Doe')).toBe('JM')
  })
})

// ─── generateColor ──────────────────────────────────────────────────────────

describe('generateColor', () => {
  it('returns HSL string', () => {
    expect(generateColor('test')).toMatch(/^hsl\(\d+, 65%, 45%\)$/)
  })

  it('is deterministic', () => {
    expect(generateColor('abc')).toBe(generateColor('abc'))
  })
})

// ─── calculateBusinessDays ──────────────────────────────────────────────────

describe('calculateBusinessDays', () => {
  it('counts weekdays only', () => {
    // Mon Jan 5 2026 to Fri Jan 9 2026 = 5 business days
    const start = new Date(2026, 0, 5)
    const end = new Date(2026, 0, 9)
    expect(calculateBusinessDays(start, end)).toBe(5)
  })

  it('excludes weekends', () => {
    // Mon Jan 5 2026 to Sun Jan 11 2026 = 5 business days (Mon-Fri)
    const start = new Date(2026, 0, 5)
    const end = new Date(2026, 0, 11)
    expect(calculateBusinessDays(start, end)).toBe(5)
  })
})

// ─── getStatusColor ─────────────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns green for completed', () => {
    expect(getStatusColor('completed')).toContain('green')
  })

  it('returns blue for in-progress', () => {
    expect(getStatusColor('in-progress')).toContain('blue')
  })

  it('returns fallback for unknown', () => {
    expect(getStatusColor('unknown')).toContain('gray')
  })
})

// ─── formatFileSize ─────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formats KB', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
  })

  it('formats MB', () => {
    expect(formatFileSize(1048576)).toBe('1 MB')
  })
})

// ─── construction namespace ─────────────────────────────────────────────────

describe('construction.getStatusColor', () => {
  it('returns completed colors', () => {
    const result = construction.getStatusColor('completed')
    expect(result.dot).toBe('bg-green-500')
  })

  it('returns not-started for unknown status', () => {
    const result = construction.getStatusColor('xyz')
    expect(result.dot).toBe('bg-gray-400')
  })

  it('supports high contrast mode', () => {
    const normal = construction.getStatusColor('completed', false)
    const high = construction.getStatusColor('completed', true)
    expect(high.bg).not.toBe(normal.bg)
  })
})

describe('construction.formatCurrency', () => {
  it('formats as USD', () => {
    expect(construction.formatCurrency(45000)).toBe('$45,000')
  })

  it('formats for screen reader', () => {
    expect(construction.formatCurrency(1500, true)).toBe('1500 dollars')
  })

  it('handles negative for screen reader', () => {
    expect(construction.formatCurrency(-500, true)).toBe('negative 500 dollars')
  })
})

describe('construction.validateField', () => {
  it('passes valid input', () => {
    expect(construction.validateField('hello', { required: true })).toEqual({ valid: true })
  })

  it('fails required empty', () => {
    const result = construction.validateField('', { required: true })
    expect(result.valid).toBe(false)
  })

  it('fails minLength', () => {
    const result = construction.validateField('ab', { minLength: 5 })
    expect(result.valid).toBe(false)
  })

  it('fails maxLength', () => {
    const result = construction.validateField('abcdef', { maxLength: 3 })
    expect(result.valid).toBe(false)
  })

  it('fails pattern', () => {
    const result = construction.validateField('abc', { pattern: /^\d+$/ })
    expect(result.valid).toBe(false)
  })
})

describe('construction.getPhaseIcon', () => {
  it('returns icon for known phase', () => {
    expect(construction.getPhaseIcon('planning')).toBe('📋')
  })

  it('returns fallback for unknown phase', () => {
    expect(construction.getPhaseIcon('unknown')).toBe('📌')
  })
})

describe('construction.getPhaseLabel', () => {
  it('returns label for known phase', () => {
    expect(construction.getPhaseLabel('foundation')).toBe('Foundation')
  })

  it('returns input for unknown phase', () => {
    expect(construction.getPhaseLabel('Custom')).toBe('Custom')
  })
})

// ─── PerformanceTimer ───────────────────────────────────────────────────────

describe('PerformanceTimer', () => {
  it('returns a positive duration for a timed operation', () => {
    const timer = new PerformanceTimer()
    timer.start('test-op')
    // Perform a trivial loop to burn a tiny amount of time
    let sum = 0
    for (let i = 0; i < 1000; i++) sum += i
    const duration = timer.end('test-op')
    expect(duration).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 when ending a label that was never started', () => {
    const timer = new PerformanceTimer()
    expect(timer.end('nonexistent')).toBe(0)
  })

  it('clears the mark after end is called', () => {
    const timer = new PerformanceTimer()
    timer.start('once')
    timer.end('once')
    // Calling end again should return 0 since the mark was deleted
    expect(timer.end('once')).toBe(0)
  })

  it('tracks multiple independent labels', () => {
    const timer = new PerformanceTimer()
    timer.start('a')
    timer.start('b')
    const durationB = timer.end('b')
    const durationA = timer.end('a')
    expect(durationB).toBeGreaterThanOrEqual(0)
    expect(durationA).toBeGreaterThanOrEqual(0)
    // 'a' was started first, so its duration should be >= 'b'
    expect(durationA).toBeGreaterThanOrEqual(durationB)
  })
})

// ─── getStatusColor (extended) ──────────────────────────────────────────────

describe('getStatusColor (extended)', () => {
  it('returns yellow for pending', () => {
    expect(getStatusColor('pending')).toContain('yellow')
  })

  it('returns red for delayed', () => {
    expect(getStatusColor('delayed')).toContain('red')
  })

  it('returns red for blocked', () => {
    expect(getStatusColor('blocked')).toContain('red')
  })

  it('handles underscore variant in_progress', () => {
    expect(getStatusColor('in_progress')).toContain('blue')
  })

  it('handles not_started variant', () => {
    expect(getStatusColor('not_started')).toContain('gray')
  })

  it('returns gray for cancelled', () => {
    expect(getStatusColor('cancelled')).toContain('gray')
  })
})

// ─── formatFileSize (extended) ──────────────────────────────────────────────

describe('formatFileSize (extended)', () => {
  it('formats small byte values', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats fractional KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats GB', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB')
  })

  it('formats large MB value with decimal', () => {
    // 2.5 MB = 2,621,440 bytes
    expect(formatFileSize(2621440)).toBe('2.5 MB')
  })
})
