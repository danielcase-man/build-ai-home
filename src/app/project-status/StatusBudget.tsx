'use client'

import { DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface Props {
  budgetUsed: number
  budgetTotal: number
  contingencyRemaining: number
}

export default function StatusBudget({ budgetUsed, budgetTotal, contingencyRemaining }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-construction-green" />
          Budget Update
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Original Budget</span>
          <span className="text-sm font-medium">${budgetTotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Current Estimate</span>
          <span className="text-sm font-medium">${budgetUsed.toLocaleString()}</span>
        </div>
        <Progress value={Math.min((budgetUsed / budgetTotal) * 100, 100)} className="h-2" />
        <div className="flex justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">Contingency Remaining</span>
          <span className="text-sm font-bold text-construction-green">${contingencyRemaining.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  )
}
