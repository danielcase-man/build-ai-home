'use client'

import { AlertTriangle, TrendingUp, Info, ArrowRight, HelpCircle, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface StatusContentCardsProps {
  hotTopics: Array<{ priority: string; text: string }>
  recentDecisions: Array<{ decision: string; impact: string }>
  aiSummary: string
  nextSteps?: string[]
  openQuestions?: Array<{ question: string; askedBy: string; needsResponseFrom?: string }>
  keyDataPoints?: Array<{ category: string; data: string; importance: string }>
}

export default function StatusContentCards({ hotTopics, recentDecisions, aiSummary, nextSteps = [], openQuestions = [], keyDataPoints = [] }: StatusContentCardsProps) {
  const getPriorityVariant = (priority: string): 'destructive' | 'warning' | 'secondary' => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      default: return 'secondary'
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-construction-red" />
            Current Hot Topics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hotTopics.length > 0 ? hotTopics.map((topic, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge variant={getPriorityVariant(topic.priority)} className="mt-0.5 shrink-0">{topic.priority}</Badge>
              <p className="text-sm">{topic.text}</p>
            </div>
          )) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Info className="h-4 w-4 shrink-0" />
              No hot topics yet. Click &quot;Generate AI Report&quot; to analyze your emails.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Decisions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recentDecisions.length > 0 ? recentDecisions.map((decision, index) => (
            <div key={index} className="flex justify-between items-start py-2 border-b last:border-0">
              <p className="text-sm flex-1">{decision.decision}</p>
              <Badge variant="success" className="ml-4 shrink-0">{decision.impact}</Badge>
            </div>
          )) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Info className="h-4 w-4 shrink-0" />
              No recent decisions recorded yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5 shrink-0">•</span>
                  {step}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Open Questions */}
      {openQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-purple-500" />
              Open Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openQuestions.map((q, index) => (
              <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm font-medium text-purple-900">{q.question}</p>
                <p className="text-xs text-purple-700 mt-1">
                  Asked by: {q.askedBy}
                  {q.needsResponseFrom && ` → Needs response from: ${q.needsResponseFrom}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Key Data Points */}
      {keyDataPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-construction-blue" />
              Key Data Points
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {keyDataPoints.map((dp, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Badge variant={dp.importance === 'critical' ? 'destructive' : dp.importance === 'important' ? 'warning' : 'secondary'} className="mt-0.5 shrink-0">
                  {dp.importance}
                </Badge>
                <div className="text-sm">
                  <span className="font-semibold">{dp.category}:</span> {dp.data}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Project Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{aiSummary}</p>
        </CardContent>
      </Card>
    </>
  )
}
