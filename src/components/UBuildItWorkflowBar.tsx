'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2,
  DollarSign,
  Eye,
  FileText,
  Settings,
  Calculator,
  Clock,
  Circle,
} from 'lucide-react'

export interface PlanningStep {
  step_number: number
  name: string
  status: string
}

interface UBuildItWorkflowBarProps {
  steps: PlanningStep[]
}

const STEP_ICONS = [DollarSign, Eye, FileText, Settings, Calculator, CheckCircle2]

const STEP_LABELS = [
  'Ballpark Budget',
  'Site Review',
  'Plan Development',
  'Specifications',
  'Estimated Budget',
  'Cost Review',
]

function getStepIcon(index: number, status: string) {
  const Icon = STEP_ICONS[index] || Circle

  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-600" />
  if (status === 'in_progress') return <Clock className="h-5 w-5 text-blue-600" />
  return <Icon className="h-5 w-5 text-muted-foreground" />
}

function getStepStyle(status: string) {
  if (status === 'completed') return 'bg-green-50 border-green-200'
  if (status === 'in_progress') return 'bg-blue-50 border-blue-200'
  return ''
}

export default function UBuildItWorkflowBar({ steps }: UBuildItWorkflowBarProps) {
  const completedCount = steps.filter(s => s.status === 'completed').length
  const totalSteps = steps.length || 6
  const progress = Math.round((completedCount / totalSteps) * 100)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            UBuildIt Planning Process
          </CardTitle>
          <Badge variant="secondary">
            {completedCount}/{totalSteps} Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid gap-2">
          {steps.map((step, index) => (
            <div
              key={step.step_number}
              className={`flex items-center gap-3 p-2 rounded-lg border border-transparent ${getStepStyle(step.status)}`}
            >
              {getStepIcon(index, step.status)}
              <div className="flex-1">
                <h4 className="text-sm font-medium">
                  Step {step.step_number}: {step.name || STEP_LABELS[index] || `Step ${step.step_number}`}
                </h4>
              </div>
              <Badge
                variant={
                  step.status === 'completed' ? 'default' :
                  step.status === 'in_progress' ? 'secondary' :
                  'outline'
                }
                className={
                  step.status === 'completed' ? 'bg-green-600' :
                  step.status === 'in_progress' ? 'bg-blue-600 text-white' :
                  ''
                }
              >
                {step.status === 'completed' ? 'Done' :
                 step.status === 'in_progress' ? 'Active' :
                 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
