import type { BudgetForecast } from '@/types'
import type { BudgetItemRecord } from './budget-service'

export function calculateForecast(
  budgetItems: BudgetItemRecord[],
  budgetTotal: number,
  startDate: string
): BudgetForecast {
  const spent = budgetItems.reduce((sum, item) => sum + (item.actual_cost ?? 0), 0)

  const start = new Date(startDate)
  const now = new Date()
  const monthsElapsed = Math.max(
    1,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  )

  // Monthly burn rate based on actual spending
  const burnRate = spent / monthsElapsed

  // Items with estimated costs but no actual costs yet
  const remainingEstimated = budgetItems
    .filter(item => !item.actual_cost || item.actual_cost === 0)
    .reduce((sum, item) => sum + (item.estimated_cost ?? 0), 0)

  // Projected total = what's spent + what's still estimated
  const projectedTotal = spent + remainingEstimated

  // Variance = budget - projected (positive = under budget)
  const variance = budgetTotal - projectedTotal

  // Estimate months remaining based on remaining estimated / burn rate
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
