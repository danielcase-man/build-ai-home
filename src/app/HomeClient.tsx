'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Calendar, CheckCircle2, DollarSign, Mail, FileText,
  Users, RefreshCw, AlertTriangle, Landmark, Clock,
  CircleHelp, ListTodo, Zap, ChevronRight, ArrowRight,
  BarChart3, Gavel, Upload,
} from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { DashboardData } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailPreview {
  sender_name: string | null
  sender_email: string
  subject: string
  received_date: string
  ai_summary: string | null
}

interface ActionItemData {
  status: string
  text: string
  action_type?: 'draft_email' | null
  action_context?: {
    to?: string
    to_name?: string
    subject_hint?: string
    context?: string
  }
}

interface OpenQuestionData {
  question: string
  askedBy: string
  needsResponseFrom?: string
}

interface DeadlineItem {
  type: 'task' | 'bid'
  title: string
  due_date: string
  days_remaining: number
  link: string
}

interface AttentionItem {
  type: 'deadline' | 'action' | 'email' | 'question' | 'vendor' | 'coverage'
  urgency: 'urgent' | 'warning' | 'normal' | 'info'
  text: string
  detail?: string
  link: string
}

interface VendorFollowUp {
  vendorName: string
  daysWaiting: number
  reason: string
  category: string | null
}

interface CoverageGap {
  name: string
  phase: string
}

interface StatusSnapshot {
  hot_topics?: unknown[]
  action_items?: unknown[]
  open_questions?: unknown[]
  next_steps?: unknown[]
  ai_summary?: string
  date?: string
}

interface LeadTimeAlertData {
  item: string
  weeks: string
  urgency: 'critical' | 'warning' | 'info'
  message: string
}

interface HomeClientProps {
  initialData: DashboardData
  initialStatus: StatusSnapshot | null
  initialEmails: EmailPreview[]
  gmailConnected: boolean
  initialDeadlines: DeadlineItem[]
  vendorFollowUps?: VendorFollowUp[]
  coverageGaps?: CoverageGap[]
  leadTimeAlerts?: LeadTimeAlertData[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ATTENTION_ICONS = {
  deadline: Clock,
  action: ListTodo,
  email: Mail,
  question: CircleHelp,
  vendor: Users,
  coverage: AlertTriangle,
} as const

const URGENCY_DOT_COLORS = {
  urgent: 'bg-red-500',
  warning: 'bg-orange-500',
  normal: 'bg-blue-500',
  info: 'bg-purple-500',
} as const

function formatStatusDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HomeClient({
  initialData,
  initialStatus,
  initialEmails,
  gmailConnected,
  initialDeadlines,
  vendorFollowUps = [],
  coverageGaps = [],
  leadTimeAlerts = [],
}: HomeClientProps) {
  const [projectData, setProjectData] = useState<DashboardData>(initialData)
  const [hotTopics, setHotTopics] = useState<string[]>(() => {
    if (!initialStatus?.hot_topics) return []
    return (initialStatus.hot_topics as Array<{ text?: string } | string>)
      .map(t => typeof t === 'string' ? t : t.text || '')
      .filter(Boolean)
  })
  const [actionItems] = useState<ActionItemData[]>(() => {
    if (!initialStatus?.action_items) return []
    return (initialStatus.action_items as ActionItemData[]).filter(i => i.text)
  })
  const [openQuestions] = useState<OpenQuestionData[]>(() => {
    if (!initialStatus?.open_questions) return []
    return (initialStatus.open_questions as OpenQuestionData[]).filter(q => q.question)
  })
  const [nextSteps, setNextSteps] = useState<string[]>((initialStatus?.next_steps || []) as string[])
  const [aiSummary, setAiSummary] = useState<string>(initialStatus?.ai_summary || '')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [emails, setEmails] = useState<EmailPreview[]>(initialEmails)
  const [loading, setLoading] = useState(false)
  const [healthIssues, setHealthIssues] = useState<Array<{ source: string; message: string }>>([])

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(res => {
        if (res.success && !res.data.healthy) {
          setHealthIssues(res.data.checks.filter((c: { status: string }) => c.status !== 'ok'))
        }
      })
      .catch(() => {})
  }, [])

  // ── Derived: unified attention feed ──

  const pendingActionItems = actionItems.filter(i => i.status !== 'completed')

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = []

    // Deadlines first, sorted by urgency
    for (const d of initialDeadlines) {
      const detail = d.days_remaining === 0
        ? 'Due today'
        : d.days_remaining === 1
          ? 'Due tomorrow'
          : `Due in ${d.days_remaining} days`
      items.push({
        type: 'deadline',
        urgency: d.days_remaining <= 2 ? 'urgent' : 'warning',
        text: d.title,
        detail,
        link: d.link,
      })
    }

    // Action items
    for (const item of pendingActionItems) {
      items.push({
        type: item.action_type === 'draft_email' ? 'email' : 'action',
        urgency: 'normal',
        text: item.text,
        detail: item.action_type === 'draft_email'
          ? `Email to ${item.action_context?.to_name || item.action_context?.to || 'contact'}`
          : undefined,
        link: item.action_type === 'draft_email' ? '/emails' : '/project-status',
      })
    }

    // Lead time alerts (long-lead items needing selection/bids)
    for (const lt of leadTimeAlerts.slice(0, 3)) {
      items.push({
        type: 'deadline',
        urgency: lt.urgency === 'critical' ? 'urgent' : 'warning',
        text: lt.message,
        detail: `${lt.weeks} week lead time`,
        link: '/selections',
      })
    }

    // Vendor follow-ups (unresponsive vendors)
    for (const v of vendorFollowUps) {
      items.push({
        type: 'vendor',
        urgency: v.daysWaiting >= 14 ? 'urgent' : v.daysWaiting >= 7 ? 'warning' : 'normal',
        text: `${v.vendorName} — no response${v.category ? ` (${v.category})` : ''}`,
        detail: `${v.daysWaiting} days waiting. ${v.reason}`,
        link: '/vendors',
      })
    }

    // Coverage gaps (required trades with no bids)
    for (const gap of coverageGaps.slice(0, 3)) {
      items.push({
        type: 'coverage',
        urgency: 'warning',
        text: `No bids for ${gap.name}`,
        detail: gap.phase,
        link: '/coverage',
      })
    }

    // Open questions
    for (const q of openQuestions) {
      items.push({
        type: 'question',
        urgency: 'info',
        text: q.question,
        detail: q.needsResponseFrom
          ? `Needs reply from ${q.needsResponseFrom}`
          : q.askedBy
            ? `Asked by ${q.askedBy}`
            : undefined,
        link: '/project-status',
      })
    }

    return items
  }, [initialDeadlines, pendingActionItems, leadTimeAlerts, vendorFollowUps, coverageGaps, openQuestions])

  // ── Refresh handlers ──

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
          pendingTasks: status.actionItems?.filter((i: { status: string; action_type?: string }) => i.status !== 'completed' && i.action_type === 'draft_email').length || 0,
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
      // Dashboard shows stale data
    }
  }

  const refreshEmails = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/emails/fetch')
      const data = await response.json()

      if (response.ok) {
        const payload = data.data || data
        if (payload.emails && Array.isArray(payload.emails)) {
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
          setProjectData(prev => ({ ...prev, unreadEmails: payload.count || 0 }))
        }
      }
    } catch {
      // Shows stale data
    } finally {
      setLoading(false)
    }
  }

  const connectGmail = async () => {
    try {
      const response = await fetch('/api/gmail/auth')
      const data = await response.json()
      const payload = data.data || data
      if (payload.authUrl) window.location.href = payload.authUrl
    } catch {
      // User can retry
    }
  }

  const progressPercent = Math.round((projectData.currentStep / projectData.totalSteps) * 100)
  const budgetPercent = projectData.budgetTotal > 0
    ? Math.round((projectData.budgetUsed / projectData.budgetTotal) * 100)
    : 0

  // ── Render ──

  return (
    <div className="space-y-6">

      {/* ── Header: title + freshness ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          {projectData.upcomingMilestone && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Next milestone: {projectData.upcomingMilestone}
              {projectData.milestoneDate && <> &middot; {projectData.milestoneDate}</>}
            </p>
          )}
        </div>
        {initialStatus?.date && (
          <p className="text-xs text-muted-foreground">
            AI analysis: {formatStatusDate(initialStatus.date)}
          </p>
        )}
      </div>

      {/* ── Health Issues Banner ── */}
      {healthIssues.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Data sync issues detected</p>
              <ul className="mt-1 space-y-0.5 text-amber-700">
                {healthIssues.map((issue, i) => (
                  <li key={i}>{issue.source}: {issue.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero: Needs Your Attention ── */}
      {attentionItems.length > 0 ? (
        <Card className="overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-r from-primary/10 via-transparent to-transparent px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Needs Your Attention</h2>
              <Badge variant="secondary" className="ml-auto tabular-nums">
                {attentionItems.length}
              </Badge>
            </div>
          </div>
          <div className="divide-y">
            {attentionItems.slice(0, 8).map((item, i) => {
              const Icon = ATTENTION_ICONS[item.type]
              return (
                <Link
                  key={i}
                  href={item.link}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-accent/50 transition-colors group"
                >
                  <div className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    URGENCY_DOT_COLORS[item.urgency],
                  )} />
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.text}</p>
                    {item.detail && (
                      <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                </Link>
              )
            })}
          </div>
          {attentionItems.length > 8 && (
            <div className="px-6 py-3 border-t">
              <Link href="/project-status" className="text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1">
                View all {attentionItems.length} items <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </Card>
      ) : (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 px-6 py-4 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-300 text-sm">All clear</p>
            <p className="text-xs text-green-600/80 dark:text-green-400/80">No urgent items need your attention right now.</p>
          </div>
        </div>
      )}

      {/* ── Progress + Compact Stats ── */}
      <Card className="animate-fade-in" style={{ animationDelay: '75ms' }}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">
              {projectData.phase.charAt(0).toUpperCase() + projectData.phase.slice(1)} Phase &mdash; Step {projectData.currentStep} of {projectData.totalSteps}
            </span>
            <span className="tabular-nums font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2.5 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            <Link href="/budget" className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-accent/50 transition-colors">
              <DollarSign className={cn('h-4 w-4', budgetPercent > 90 ? 'text-red-500' : budgetPercent > 70 ? 'text-orange-500' : 'text-construction-green')} />
              <div>
                <p className="text-[11px] text-muted-foreground leading-none mb-1">Budget</p>
                <p className="text-sm font-semibold tabular-nums leading-none">
                  ${(projectData.budgetUsed / 1000).toFixed(0)}k<span className="font-normal text-muted-foreground">/{(projectData.budgetTotal / 1000).toFixed(0)}k</span>
                </p>
              </div>
            </Link>
            <Link href="/emails" className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-accent/50 transition-colors">
              <Mail className="h-4 w-4 text-construction-blue" />
              <div>
                <p className="text-[11px] text-muted-foreground leading-none mb-1">Emails</p>
                <p className="text-sm font-semibold tabular-nums leading-none">
                  {projectData.unreadEmails}<span className="font-normal text-muted-foreground"> unread</span>
                </p>
              </div>
            </Link>
            <Link href="/project-status" className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-accent/50 transition-colors">
              <CheckCircle2 className="h-4 w-4 text-construction-orange" />
              <div>
                <p className="text-[11px] text-muted-foreground leading-none mb-1">Action Items</p>
                <p className="text-sm font-semibold tabular-nums leading-none">
                  {projectData.pendingTasks}<span className="font-normal text-muted-foreground"> to do</span>
                </p>
              </div>
            </Link>
            <Link href="/timeline" className="flex items-center gap-2.5 rounded-lg p-2.5 hover:bg-accent/50 transition-colors">
              <Calendar className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-[11px] text-muted-foreground leading-none mb-1">Timeline</p>
                <p className="text-sm font-semibold tabular-nums leading-none">
                  {projectData.totalDays - projectData.daysElapsed}<span className="font-normal text-muted-foreground">d left</span>
                </p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ── UBuildIt Workflow Steps ── */}
      {projectData.planningSteps.length > 0 && (
        <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <UBuildItWorkflowBar steps={projectData.planningSteps} />
        </div>
      )}

      {/* ── AI Summary + Recent Communications ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: '225ms' }}>
        {/* AI Summary */}
        {aiSummary ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                AI Project Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-5">{aiSummary}</p>
              <Link
                href="/project-status"
                className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:text-primary/80 font-medium"
              >
                Full report <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex flex-col items-center justify-center py-8 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No AI analysis yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Upload documents or sync emails to generate insights</p>
          </Card>
        )}

        {/* Recent Communications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-construction-blue" />
              Recent Communications
              {loading && <RefreshCw className="h-3.5 w-3.5 ml-1 animate-spin text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!gmailConnected && emails.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Connect Gmail to see project emails
                </p>
                <Button size="sm" onClick={connectGmail}>Connect Gmail</Button>
              </div>
            ) : emails.length > 0 ? (
              <div className="space-y-3">
                {emails.map((email, index) => (
                  <div key={index} className="border-l-2 border-primary/40 pl-3 py-0.5">
                    <p className="text-sm font-medium leading-tight">
                      {email.sender_name || email.sender_email.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{email.subject}</p>
                    {email.ai_summary && (
                      <p className="text-xs text-muted-foreground/80 mt-0.5 italic line-clamp-2">{email.ai_summary}</p>
                    )}
                  </div>
                ))}
                <Link
                  href="/emails"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium"
                >
                  All emails <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">No recent emails</p>
                <Button variant="ghost" size="sm" onClick={refreshEmails} className="h-7 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sync
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Hot Topics (compact) ── */}
      {hotTopics.length > 0 && (
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-construction-red" />
              Hot Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hotTopics.map((topic, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={cn(
                    'h-2 w-2 rounded-full mt-1.5 shrink-0',
                    i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-yellow-500',
                  )} />
                  <p className="text-sm text-muted-foreground">{topic}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Next Steps (compact) ── */}
      {nextSteps.length > 0 && (
        <Card className="animate-fade-in" style={{ animationDelay: '375ms' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary/60 mt-0.5 shrink-0">&bull;</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions (compact strip) ── */}
      <div className="flex flex-wrap items-center gap-2 pt-1 animate-fade-in" style={{ animationDelay: '450ms' }}>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Project Document</DialogTitle>
              <DialogDescription>
                Upload emails, contracts, plans, or any project documents. AI will analyze them and update your project data.
              </DialogDescription>
            </DialogHeader>
            <FileUpload onUploadComplete={() => {
              setUploadOpen(false)
              refreshDashboardData()
            }} />
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" className="h-8" asChild>
          <Link href="/emails"><Mail className="h-3.5 w-3.5 mr-1.5" />Emails</Link>
        </Button>
        <Button variant="outline" size="sm" className="h-8" asChild>
          <Link href="/budget"><DollarSign className="h-3.5 w-3.5 mr-1.5" />Budget</Link>
        </Button>
        <Button variant="outline" size="sm" className="h-8" asChild>
          <Link href="/bids"><Gavel className="h-3.5 w-3.5 mr-1.5" />Bids</Link>
        </Button>
        <Button variant="outline" size="sm" className="h-8" asChild>
          <Link href="/financing"><Landmark className="h-3.5 w-3.5 mr-1.5" />Financing</Link>
        </Button>
        <Button variant="outline" size="sm" className="h-8" asChild>
          <Link href="/project-status"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Status</Link>
        </Button>
      </div>
    </div>
  )
}
