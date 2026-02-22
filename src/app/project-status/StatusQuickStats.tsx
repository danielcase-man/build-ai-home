'use client'

import { TrendingUp, Clock, DollarSign, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface QuickStatsProps {
  phase: string
  currentStep: number
  totalSteps: number
  daysElapsed: number
  totalDays: number
  budgetStatus: string
  nextMilestone: string
  progressPercentage: number
}

export default function StatusQuickStats(props: QuickStatsProps) {
  return (
    <>
      <div className="space-y-1">
        <Progress value={props.progressPercentage} className="h-2" />
        <p className="text-xs text-muted-foreground">Overall Progress: {props.progressPercentage}%</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-construction-blue shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phase</p>
                <p className="font-semibold text-sm">{props.phase} - Step {props.currentStep}/{props.totalSteps}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Days Elapsed</p>
                <p className="font-semibold text-sm">{props.daysElapsed}/{props.totalDays}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-construction-green shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Budget Status</p>
                <p className="font-semibold text-sm text-construction-green">{props.budgetStatus}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-construction-orange shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Next Milestone</p>
                <p className="font-semibold text-xs">{props.nextMilestone}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
