import type { BudgetForecast } from '@/types'
import type { BudgetItemRecord } from './budget-service'

// Categories that are one-time / non-recurring and should not factor into burn rate
const NON_RECURRING_CATEGORIES = new Set([
  'land acquisition', 'land', 'hoa & property tax', 'hoa',
  'software & tools', 'software', 'pool design',
])

function isRecurringConstruction(category: string | null | undefined): boolean {
  if (!category) return true
  return !NON_RECURRING_CATEGORIES.has(category.toLowerCase())
}

export function calculateForecast(
  budgetItems: BudgetItemRecord[],
  budgetTotal: number,
  startDate: string
): BudgetForecast {
  const spent = budgetItems.reduce((sum, item) => sum + (item.actual_cost ?? 0), 0)

  // Construction-only spending (exclude land, HOA, software for burn rate)
  const constructionSpent = budgetItems
    .filter(item => isRecurringConstruction(item.category))
    .reduce((sum, item) => sum + (item.actual_cost ?? 0), 0)

  const start = new Date(startDate)
  const now = new Date()
  const monthsElapsed = Math.max(
    1,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  )

  // Burn rate based on CONSTRUCTION spending only (not land purchase)
  const burnRate = constructionSpent / monthsElapsed

  // Items with estimated costs but no actual costs yet
  const remainingEstimated = budgetItems
    .filter(item => !item.actual_cost || item.actual_cost === 0)
    .reduce((sum, item) => sum + (item.estimated_cost ?? 0), 0)

  // Projected total = what's spent + what's still estimated
  const projectedTotal = spent + remainingEstimated

  // Variance = budget - projected (positive = under budget)
  const variance = budgetTotal - projectedTotal

  // Estimate months remaining based on remaining estimated / construction burn rate
  const estimatedMonthsRemaining = burnRate > 0
    ? Math.ceil(remainingEstimated / burnRate)
    : 0

  // Health status based on variance as percentage of total
  const variancePercent = (variance / budgetTotal) * 100
  let healthStatus: BudgetForecast['healthStatus']
  if (variancePercent >= 0) {
    healthStatus = 'healthy'
  } else if (variancePercent >= -5) {
    healthStatus = 'caution'
  } else {
    healthStatus = 'over_budget'
  }

  return {
    spent,
    burnRate: Math.round(burnRate),
    projectedTotal: Math.round(projectedTotal),
    variance: Math.round(variance),
    healthStatus,
    monthsElapsed,
    estimatedMonthsRemaining,
  }
}
