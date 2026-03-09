'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2, DollarSign, Mail, FileText, Users, RefreshCw, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import FileUpload from '@/components/FileUpload'
import UBuildItWorkflowBar from '@/components/UBuildItWorkflowBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { DashboardData } from '@/types'

interface EmailPreview {
  sender_name: string | null
  sender_email: string
  subject: string
  received_date: string
  ai_summary: string | null
}

interface StatusSnapshot {
  hot_topics?: unknown[]
  action_items?: unknown[]
  next_steps?: unknown[]
  ai_summary?: string
  date?: string
}

interface HomeClientProps {
  initialData: DashboardData
  initialStatus: StatusSnapshot | null
  initialEmails: EmailPreview[]
  gmailConnected: boolean
}

export default function HomeClient({ initialData, initialStatus, initialEmails, gmailConnected }: HomeClientProps) {
  const [projectData, setProjectData] = useState<DashboardData>(initialData)
  const [hotTopics, setHotTopics] = useState<string[]>(() => {
    if (!initialStatus?.hot_topics) return []
    return (initialStatus.hot_topics as Array<{ text?: string } | string>).map(t => typeof t === 'string' ? t : t.text || '').filter(Boolean)
  })
  const [nextSteps, setNextSteps] = useState<string[]>((initialStatus?.next_steps || []) as string[])
  const [aiSummary, setAiSummary] = useState<string>(initialStatus?.ai_summary || '')
  const [uploadOpen, setUploadOpen] = useState(false)

  const [emails, setEmails] = useState<EmailPreview[]>(initialEmails)
  const [loading, setLoading] = useState(false)

  const refreshDashboardData = async () => {
    try {
      const response = await fetch('/api/project-status')
      const data = await response.json()
      const payload = data.data || data

      if (payload.status) {
        const status = payload.status
        setProjectData(prev => ({
          ...prev,
          phase: status.phase || 'Planning',
          currentStep: status.stepNumber || 1,
          totalSteps: status.totalSteps || 6,
          daysElapsed: status.daysElapsed || 0,
          totalDays: status.totalDays || 117,
          budgetUsed: status.budgetUsed || 0,
          budgetTotal: status.budgetTotal || 450000,
          unreadEmails: 0,
          pendingTasks: status.actionItems?.filter((i: { status: string }) => i.status !== 'completed').length || 0,
          upcomingMilestone: status.nextMilestone || '',
          milestoneDate: status.milestoneDate || '',
        }))

        if (status.hotTopics && Array.isArray(status.hotTopics)) {
          setHotTopics(status.hotTopics.map((t: { text?: string } | string) =>
            typeof t === 'string' ? t : t.text || ''
          ).filter(Boolean))
        }
        if (status.nextSteps) setNextSteps(status.nextSteps)
        if (status.aiSummary) setAiSummary(status.aiSummary)
      }
    } catch {
      // Silently ignore — dashboard will show stale data
    }
  }

  /** Refresh emails on demand (user clicks button). Not called on mount. */
  const refreshEmails = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/emails/fetch')
      const data = await response.json()

      if (response.ok) {
        const payload = data.data || data
        if (payload.emails && Array.isArray(payload.emails)) {
          // Map API response to preview format
          const previews: EmailPreview[] = payload.emails.slice(0, 3).map((e: {
            from?: string; subject?: string; date?: string; aiSummary?: string;
            sender_name?: string; sender_email?: string; received_date?: string; ai_summary?: string;
          }) => ({
            sender_name: e.sender_name ?? (e.from?.split('<')[0].trim() || null),
            sender_email: e.sender_email ?? e.from ?? '',
            subject: e.subject ?? '',
            received_date: e.received_date ?? e.date ?? '',
            ai_summary: e.ai_summary ?? e.aiSummary ?? null,
          }))
          setEmails(previews)
          setProjectData(prev => ({
            ...prev,
            unreadEmails: payload.count || 0
          }))
        }
      }
    } catch {
      // Silently ignore — emails section will show stale data
    } finally {
      setLoading(false)
    }
  }

  const connectGmail = async () => {
    try {
      const response = await fetch('/api/gmail/auth')
      const data = await response.json()
      const payload = data.data || data
      if (payload.authUrl) {
        window.location.href = payload.authUrl
      }
    } catch {
      // Silently ignore — user can retry
    }
  }

  const progressPercent = Math.round((projectData.currentStep / projectData.totalSteps) * 100)

  return (
    <div className="container py-8 space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">
              {projectData.phase} Phase - Step {projectData.currentStep} of {projectData.totalSteps}
            </span>
            <span className="text-muted-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Day {projectData.daysElapsed} of {projectData.totalDays}</span>
            <span>
              Next: {projectData.upcomingMilestone}
              {projectData.milestoneDate && ` - ${projectData.milestoneDate}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* UBuildIt Workflow Steps */}
      {projectData.planningSteps.length > 0 && (
        <UBuildItWorkflowBar steps={projectData.planningSteps} />
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in" style={{ animationDelay: '0ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Status</p>
                <p className="text-2xl font-bold">
                  ${(projectData.budgetUsed / 1000).toFixed(0)}k
                </p>
                <p className="text-xs text-muted-foreground">
                  of ${(projectData.budgetTotal / 1000).toFixed(0)}k
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-construction-green" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '75ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread Emails</p>
                <p className="text-2xl font-bold">{projectData.unreadEmails}</p>
                <p className="text-xs text-muted-foreground">from project team</p>
              </div>
              <Mail className="h-8 w-8 text-construction-blue" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold">{projectData.pendingTasks}</p>
                <p className="text-xs text-muted-foreground">for this week</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-construction-orange" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '225ms' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Days Remaining</p>
                <p className="text-2xl font-bold">{projectData.totalDays - projectData.daysElapsed}</p>
                <p className="text-xs text-muted-foreground">in planning phase</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Project Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{aiSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Hot Topics & Recent Communications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-construction-red" />
              Hot Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hotTopics.length > 0 ? (
              <ul className="space-y-3">
                {hotTopics.map((topic, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Badge
                      variant={index === 0 ? 'destructive' : index === 1 ? 'warning' : 'secondary'}
                      className="mt-0.5 shrink-0"
                    >
                      {index === 0 ? 'High' : index === 1 ? 'Med' : 'Low'}
                    </Badge>
                    <span className="text-sm">{topic}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-1">No hot topics yet</p>
                <p className="text-xs text-muted-foreground">Upload documents to extract project information</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-construction-blue" />
              Recent Communications
              {loading && <RefreshCw className="h-4 w-4 ml-1 animate-spin text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!gmailConnected && emails.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Connect your Gmail to see real project emails
                </p>
                <Button onClick={connectGmail}>
                  Connect Gmail Account
                </Button>
              </div>
            ) : emails.length > 0 ? (
              <div className="space-y-3">
                {emails.map((email, index) => (
                  <div key={index} className="border-l-4 border-primary pl-3 py-1">
                    <p className="text-sm font-medium">
                      {email.sender_name || email.sender_email.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground">{email.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(email.received_date).toLocaleDateString()}
                    </p>
                    {email.ai_summary && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{email.ai_summary}</p>
                    )}
                  </div>
                ))}
                <Link
                  href="/emails"
                  className="block mt-3 text-center text-sm text-primary hover:text-primary/80 font-medium"
                >
                  View All Emails &rarr;
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No recent project emails</p>
                <Button variant="ghost" size="sm" onClick={refreshEmails}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sync from Gmail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-0.5">&#8226;</span>
                  {step}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
                  <FileText className="h-6 w-6" />
                  <span className="text-sm">Upload Document</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Upload Project Document</DialogTitle>
                  <DialogDescription>
                    Upload emails, contracts, plans, or any project documents. Our AI will analyze them and automatically update your project data.
                  </DialogDescription>
                </DialogHeader>
                <FileUpload onUploadComplete={() => {
                  setUploadOpen(false)
                  refreshDashboardData()
                }} />
              </DialogContent>
            </Dialog>

            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
              <Link href="/emails">
                <Mail className="h-6 w-6" />
                <span className="text-sm">View Emails</span>
              </Link>
            </Button>

            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Calendar className="h-6 w-6" />
              <span className="text-sm">View Timeline</span>
            </Button>

            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <DollarSign className="h-6 w-6" />
              <span className="text-sm">Budget Details</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
