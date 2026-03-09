'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { BudgetForecast } from '@/types'

interface BudgetForecastCardProps {
  forecast: BudgetForecast
  budgetTotal: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getHealthBadge(status: BudgetForecast['healthStatus']) {
  switch (status) {
    case 'healthy':
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">On Track</Badge>
    case 'caution':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Caution</Badge>
    case 'over_budget':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Over Budget</Badge>
  }
}

export default function BudgetForecastCard({ forecast, budgetTotal }: BudgetForecastCardProps) {
  const spentPercent = Math.min(100, Math.round((forecast.spent / budgetTotal) * 100))
  const projectedPercent = Math.min(100, Math.round((forecast.projectedTotal / budgetTotal) * 100))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {forecast.variance >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : forecast.variance >= -budgetTotal * 0.05 ? (
              <Minus className="h-4 w-4 text-amber-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            Budget Forecast
          </CardTitle>
          {getHealthBadge(forecast.healthStatus)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bars */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Spent: {formatCurrency(forecast.spent)}</span>
            <span>{spentPercent}%</span>
          </div>
          <Progress value={spentPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Projected: {formatCurrency(forecast.projectedTotal)}</span>
            <span>{projectedPercent}%</span>
          </div>
          <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                forecast.healthStatus === 'healthy'
                  ? 'bg-emerald-500'
                  : forecast.healthStatus === 'caution'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${projectedPercent}%` }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Burn Rate</p>
            <p className="text-sm font-semibold">{formatCurrency(forecast.burnRate)}/mo</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Variance</p>
            <p className={`text-sm font-semibold ${forecast.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {forecast.variance >= 0 ? '+' : ''}{formatCurrency(forecast.variance)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Est. Remaining</p>
            <p className="text-sm font-semibold">
              {forecast.estimatedMonthsRemaining > 0
                ? `~${forecast.estimatedMonthsRemaining} mo`
                : 'Complete'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
