'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar, CheckCircle, AlertTriangle, DollarSign, MessageSquare, TrendingUp, Clock, Square, Timer, Mail, Send, Edit3, X, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { ProjectStatusData, DraftEmail } from '@/types'

export default function ProjectStatusClient({ initialData }: { initialData: ProjectStatusData }) {
  const [statusData] = useState<ProjectStatusData>({
    ...initialData,
    date: new Date(initialData.date)
  })
  const [generatingDraftFor, setGeneratingDraftFor] = useState<number | null>(null)
  const [activeDraft, setActiveDraft] = useState<DraftEmail | null>(null)
  const [editingDraft, setEditingDraft] = useState<DraftEmail | null>(null)
  const [sendingDraft, setSendingDraft] = useState(false)

  const handleGenerateDraft = async (index: number, item: ProjectStatusData['actionItems'][0]) => {
    setGeneratingDraftFor(index)
    try {
      const response = await fetch('/api/emails/drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: item.action_context?.to,
          toName: item.action_context?.to_name,
          subjectHint: item.action_context?.subject_hint,
          context: item.action_context?.context || item.text
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate draft')
      setActiveDraft(data.data.draft)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate draft')
    } finally {
      setGeneratingDraftFor(null)
    }
  }

  const handleSendDraft = async (draft: DraftEmail) => {
    setSendingDraft(true)
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: draft.to,
          subject: draft.subject,
          body: draft.body
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send email')
      toast.success(`Email sent to ${draft.toName || draft.to}`)
      setActiveDraft(null)
      setEditingDraft(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSendingDraft(false)
    }
  }

  const getPriorityVariant = (priority: string): 'destructive' | 'warning' | 'secondary' => {
    switch(priority) {
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-construction-green" />
      case 'in-progress': return <Timer className="h-4 w-4 text-construction-orange" />
      default: return <Square className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header with Progress */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Status Report</h1>
          <p className="text-sm text-muted-foreground">{format(statusData.date, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="space-y-1">
          <Progress value={statusData.progressPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground">Overall Progress: {statusData.progressPercentage}%</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="animate-fade-in" style={{ animationDelay: '0ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-construction-blue shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phase</p>
                <p className="font-semibold text-sm">{statusData.phase} - Step {statusData.stepNumber}/{statusData.totalSteps}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '75ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Days Elapsed</p>
                <p className="font-semibold text-sm">{statusData.daysElapsed}/{statusData.totalDays}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-construction-green shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Budget Status</p>
                <p className="font-semibold text-sm text-construction-green">{statusData.budgetStatus}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in" style={{ animationDelay: '225ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-construction-orange shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Next Milestone</p>
                <p className="font-semibold text-xs">{statusData.nextMilestone}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hot Topics */}
      {statusData.hotTopics.length > 0 && (
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-construction-red" />
              Current Hot Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusData.hotTopics.map((topic, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Badge variant={getPriorityVariant(topic.priority)} className="mt-0.5 shrink-0">
                  {topic.priority}
                </Badge>
                <p className="text-sm">{topic.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action Items */}
      {statusData.actionItems.length > 0 && (
        <Card className="animate-fade-in" style={{ animationDelay: '375ms' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-construction-blue" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {statusData.actionItems.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  {getStatusIcon(item.status)}
                  <span className={`text-sm flex-1 ${item.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                    {item.text}
                  </span>
                  {item.action_type === 'draft_email' && item.status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={generatingDraftFor === index}
                      onClick={() => handleGenerateDraft(index, item)}
                    >
                      {generatingDraftFor === index ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3 mr-1" />
                      )}
                      Draft Email
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recent Communications */}
      {statusData.recentCommunications.length > 0 && (
        <Card className="animate-fade-in" style={{ animationDelay: '450ms' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-500" />
              Recent Discussions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusData.recentCommunications.map((comm, index) => (
              <div key={index} className="border-l-4 border-primary pl-3">
                <p className="text-sm font-medium">{comm.from}</p>
                <p className="text-sm text-muted-foreground">{comm.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Decisions */}
      {statusData.recentDecisions.length > 0 && (
        <Card className="animate-fade-in" style={{ animationDelay: '525ms' }}>
          <CardHeader>
            <CardTitle className="text-lg">Recent Decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusData.recentDecisions.map((decision, index) => (
              <div key={index} className="flex justify-between items-start py-2 border-b last:border-0">
                <p className="text-sm flex-1">{decision.decision}</p>
                <Badge variant="success" className="ml-4 shrink-0">{decision.impact}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Budget Snapshot */}
      <Card className="animate-fade-in" style={{ animationDelay: '600ms' }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-construction-green" />
            Budget Update
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Original Budget</span>
            <span className="text-sm font-medium">${statusData.budgetTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Current Estimate</span>
            <span className="text-sm font-medium">${statusData.budgetUsed.toLocaleString()}</span>
          </div>
          <Progress
            value={Math.min((statusData.budgetUsed / statusData.budgetTotal) * 100, 100)}
            className="h-2"
          />
          <div className="flex justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Contingency Remaining</span>
            <span className="text-sm font-bold text-construction-green">${statusData.contingencyRemaining.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* AI Summary */}
      <Card className="border-l-4 border-l-primary animate-fade-in" style={{ animationDelay: '675ms' }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Project Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{statusData.aiSummary}</p>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-muted-foreground">
        <p>Last updated: {format(new Date(), 'h:mm a')}</p>
        <p className="mt-1">This report is automatically generated daily</p>
      </div>

      {/* Draft Email Review Dialog */}
      <Dialog open={!!activeDraft && !editingDraft} onOpenChange={(open) => { if (!open) setActiveDraft(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Review Draft Email
            </DialogTitle>
            <DialogDescription>
              AI-generated draft for your review
            </DialogDescription>
          </DialogHeader>

          {activeDraft && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">To: </span>
                {activeDraft.toName ? `${activeDraft.toName} <${activeDraft.to}>` : activeDraft.to}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Subject: </span>
                {activeDraft.subject}
              </div>
              {activeDraft.reason && (
                <div className="text-xs text-primary/80 italic">
                  {activeDraft.reason}
                </div>
              )}
              <div className="border rounded p-3 bg-white text-sm max-h-64 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: activeDraft.body }} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setActiveDraft(null)}>
              <X className="h-3 w-3 mr-1" />
              Dismiss
            </Button>
            <Button variant="outline" onClick={() => { setEditingDraft(activeDraft); }}>
              <Edit3 className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button onClick={() => activeDraft && handleSendDraft(activeDraft)} disabled={sendingDraft}>
              {sendingDraft ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Draft Dialog */}
      <Dialog open={!!editingDraft} onOpenChange={(open) => { if (!open) setEditingDraft(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Edit Draft Email
            </DialogTitle>
            <DialogDescription>
              Modify before sending
            </DialogDescription>
          </DialogHeader>

          {editingDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="draft-to">To</Label>
                <Input
                  id="draft-to"
                  value={editingDraft.to}
                  onChange={e => setEditingDraft({ ...editingDraft, to: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-subject">Subject</Label>
                <Input
                  id="draft-subject"
                  value={editingDraft.subject}
                  onChange={e => setEditingDraft({ ...editingDraft, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-body">Body (HTML)</Label>
                <Textarea
                  id="draft-body"
                  value={editingDraft.body}
                  onChange={e => setEditingDraft({ ...editingDraft, body: e.target.value })}
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label>Preview</Label>
                <div className="mt-1 border rounded p-3 bg-white text-sm max-h-48 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: editingDraft.body }} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingDraft(null)}>
              Cancel
            </Button>
            <Button onClick={() => editingDraft && handleSendDraft(editingDraft)} disabled={sendingDraft}>
              {sendingDraft ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
