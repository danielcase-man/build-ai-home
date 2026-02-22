'use client'

import { AlertTriangle, TrendingUp, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface StatusContentCardsProps {
  hotTopics: Array<{ priority: string; text: string }>
  recentDecisions: Array<{ decision: string; impact: string }>
  aiSummary: string
}

export default function StatusContentCards({ hotTopics, recentDecisions, aiSummary }: StatusContentCardsProps) {
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
