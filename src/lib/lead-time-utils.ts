/**
 * Lead-Time Utilities — parse human-readable lead time strings into days.
 */

/**
 * Parse a lead-time string into a number of days, taking the maximum value for ranges.
 *
 * Supported formats:
 *   "6-8 weeks" → 56
 *   "90 days" → 90
 *   "4-6 months" → 180
 *   "12 weeks" → 84
 *   "3 months" → 90
 *   "2-3 wks" → 21
 *
 * Returns null if the string cannot be parsed.
 */
export function parseLeadTimeDays(str: string): number | null {
  if (!str || typeof str !== 'string') return null

  const normalized = str.trim().toLowerCase()
  if (!normalized) return null

  // Match patterns like "6-8 weeks", "90 days", "4 months", "2-3 wks"
  const match = normalized.match(/(\d+)(?:\s*[-–to]+\s*(\d+))?\s*(day|days|week|weeks|wk|wks|month|months|mo|mos)/)
  if (!match) return null

  const num1 = parseInt(match[1], 10)
  const num2 = match[2] ? parseInt(match[2], 10) : null
  const unit = match[3]

  // Take the maximum value in a range
  const value = num2 !== null ? Math.max(num1, num2) : num1

  if (unit.startsWith('day')) {
    return value
  } else if (unit.startsWith('week') || unit.startsWith('wk')) {
    return value * 7
  } else if (unit.startsWith('month') || unit.startsWith('mo')) {
    return value * 30
  }

  return null
}

/**
 * Calculate the order-by date given a phase start date and lead time in days.
 * Returns the date by which an order must be placed.
 */
export function calculateOrderByDate(phaseStartDate: Date, leadTimeDays: number): Date {
  const orderBy = new Date(phaseStartDate)
  orderBy.setDate(orderBy.getDate() - leadTimeDays)
  return orderBy
}
