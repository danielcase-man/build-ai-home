'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Calendar, CheckCircle2, DollarSign, Mail, FileText,
  Users, RefreshCw, AlertTriangle, Landmark, Clock,
  CircleHelp, ListTodo, Zap, ChevronRight, ArrowRight,
  BarChart3, Gavel, Upload, Circle, Check, Loader2,
  Send, Edit3, X,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import IntegrityScoreCard from '@/components/IntegrityScoreCard'
import type { DashboardData, DraftEmail } from '@/types'

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
  task_id?: string
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
  task_id?: string
  action_type?: 'draft_email' | null
  action_context?: {
    to?: string
    to_name?: string
    subject_hint?: string
    context?: string
  }
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

interface IntelligenceDiffData {
  since: string
  bids_extracted: number
  documents_cataloged: number
  contracts_found: number
  invoices_created: number
  tasks_created: number
  follow_ups_tracked: number
  total_files_processed: number
  items: Array<{
    type: 'bid' | 'document' | 'contract' | 'invoice' | 'task' | 'follow_up'
    title: string
    detail?: string
    amount?: number
    created_at: string
  }>
  last_run_at: string | null
  runs_since: number
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
  intelligenceDiff?: IntelligenceDiffData | null
  integrityScore?: number | null
  integrityIssueCount?: number
  integrityCriticalCount?: number
  integrityHighCount?: number
  integrityLastRunAt?: string | null
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
  intelligenceDiff,
  integrityScore,
  integrityIssueCount = 0,
  integrityCriticalCount = 0,
  integrityHighCount = 0,
  integrityLastRunAt,
}: HomeClientProps) {
  const [projectData, setProjectData] = useState<DashboardData>(initialData)
  const [hotTopics, setHotTopics] = useState<string[]>(() => {
    if (!initialStatus?.hot_topics) return []
    return (initialStatus.hot_topics as Array<{ text?: string } | string>)
      .map(t => typeof t === 'string' ? t : t.text || '')
      .filter(Boolean)
  })
  const [actionItems, setActionItems] = useState<ActionItemData[]>(() => {
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

  // ── Task completion state ──
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [completionLoading, setCompletionLoading] = useState(false)
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null)
  const noteInputRef = useRef<HTMLInputElement>(null)

  const handleCompleteTask = useCallback(async (taskId: string) => {
    setCompletionLoading(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: completionNote || undefined }),
      })
      if (!res.ok) throw new Error('Failed to complete task')

      // Show the green check briefly, then remove the item
      setCompletedTaskId(taskId)
      setCompletingTaskId(null)
      setCompletionNote('')

      // After fade-out animation completes, remove from state
      setTimeout(() => {
        setActionItems(prev => prev.filter(i => i.task_id !== taskId))
        setCompletedTaskId(null)
      }, 600)
    } catch {
      // Revert UI — keep the item visible
      setCompletingTaskId(null)
    } finally {
      setCompletionLoading(false)
    }
  }, [completionNote])

  // ── Email draft state ──
  const [generatingDraftFor, setGeneratingDraftFor] = useState<string | null>(null)
  const [activeDraft, setActiveDraft] = useState<DraftEmail | null>(null)
  const [editingDraft, setEditingDraft] = useState<DraftEmail | null>(null)
  const [sendingDraft, setSendingDraft] = useState(false)
  const [draftSourceTaskId, setDraftSourceTaskId] = useState<string | null>(null)

  const handleGenerateDraft = useCallback(async (item: AttentionItem) => {
    const key = item.task_id || item.text
    setGeneratingDraftFor(key)
    try {
      const response = await fetch('/api/emails/drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: item.action_context?.to,
          toName: item.action_context?.to_name,
          subjectHint: item.action_context?.subject_hint,
          context: item.action_context?.context || item.text,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate draft')
      setActiveDraft(data.data.draft)
      setDraftSourceTaskId(item.task_id || null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate draft')
    } finally {
      setGeneratingDraftFor(null)
    }
  }, [])

  const handleSendDraft = useCallback(async (draft: DraftEmail) => {
    setSendingDraft(true)
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: draft.to, subject: draft.subject, body: draft.body }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to send email')
      toast.success(`Email sent to ${draft.toName || draft.to}`)
      setActiveDraft(null)
      setEditingDraft(null)

      // Auto-complete the related task
      if (draftSourceTaskId) {
        try {
          await fetch(`/api/tasks/${draftSourceTaskId}/complete`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: `Email sent to ${draft.toName || draft.to}: ${draft.subject}` }),
          })
          setCompletedTaskId(draftSourceTaskId)
          setTimeout(() => {
            setActionItems(prev => prev.filter(i => i.task_id !== draftSourceTaskId))
            setCompletedTaskId(null)
          }, 600)
        } catch { /* task completion is non-fatal */ }
        setDraftSourceTaskId(null)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSendingDraft(false)
    }
  }, [draftSourceTaskId])

  // Auto-focus the note input when it appears
  useEffect(() => {
    if (completingTaskId && noteInputRef.current) {
      noteInputRef.current.focus()
    }
  }, [completingTaskId])

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
        task_id: item.task_id,
        action_type: item.action_type,
        action_context: item.action_context,
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
          <div className="flex items-start justify-between gap-2">
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
            {healthIssues.some(i => i.source === 'Gmail') && (
              <Link
                href="/emails?reconnect=true"
                className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
              >
                Reconnect Gmail
              </Link>
            )}
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
              const isCompleted = item.task_id === completedTaskId
              const isExpanded = item.task_id === completingTaskId

              // Items with a task_id get an interactive completion row
              if (item.task_id) {
                return (
                  <div
                    key={item.task_id}
                    className={cn(
                      'transition-all duration-500',
                      isCompleted && 'opacity-0 max-h-0 overflow-hidden',
                      !isCompleted && 'max-h-40',
                    )}
                  >
                    <div className="flex items-center gap-3 px-6 py-3 group">
                      {/* Check button */}
                      <button
                        onClick={() => {
                          if (isExpanded) {
                            // Collapse without completing
                            setCompletingTaskId(null)
                            setCompletionNote('')
                          } else {
                            setCompletingTaskId(item.task_id!)
                            setCompletionNote('')
                          }
                        }}
                        className={cn(
                          'shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isCompleted
                            ? 'text-green-500'
                            : isExpanded
                              ? 'text-primary'
                              : 'text-muted-foreground/40 hover:text-primary',
                        )}
                        aria-label={isExpanded ? 'Cancel completion' : 'Complete task'}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                      <div className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        URGENCY_DOT_COLORS[item.urgency],
                      )} />
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm truncate transition-colors',
                          isCompleted && 'line-through text-muted-foreground',
                        )}>{item.text}</p>
                        {item.detail && (
                          <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                        )}
                      </div>
                      {item.action_type === 'draft_email' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 h-7 px-2.5 text-xs"
                          disabled={generatingDraftFor === (item.task_id || item.text)}
                          onClick={() => handleGenerateDraft(item)}
                        >
                          {generatingDraftFor === (item.task_id || item.text) ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Mail className="h-3 w-3 mr-1" />
                          )}
                          Draft
                        </Button>
                      ) : (
                        <Link
                          href={item.link}
                          className="shrink-0"
                          aria-label="View details"
                        >
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
                        </Link>
                      )}
                    </div>
                    {/* Inline note input — slides down when expanded */}
                    {isExpanded && (
                      <div className="px-6 pb-3 flex items-center gap-2 animate-fade-in">
                        <div className="w-5 shrink-0" /> {/* spacer to align with content */}
                        <Input
                          ref={noteInputRef}
                          value={completionNote}
                          onChange={e => setCompletionNote(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCompleteTask(item.task_id!)
                            if (e.key === 'Escape') {
                              setCompletingTaskId(null)
                              setCompletionNote('')
                            }
                          }}
                          placeholder="Add a note (optional) then press Enter"
                          className="h-8 text-sm flex-1"
                          disabled={completionLoading}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => handleCompleteTask(item.task_id!)}
                          disabled={completionLoading}
                        >
                          {completionLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5 mr-1" />
                          )}
                          {completionLoading ? '' : 'Done'}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              }

              // Items without task_id: email actions get draft button, others get link
              if (item.action_type === 'draft_email') {
                return (
                  <div
                    key={i}
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-7 px-2.5 text-xs"
                      disabled={generatingDraftFor === item.text}
                      onClick={() => handleGenerateDraft(item)}
                    >
                      {generatingDraftFor === item.text ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3 mr-1" />
                      )}
                      Draft
                    </Button>
                  </div>
                )
              }

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

      {/* ── Intelligence Diff (since yesterday) ── */}
      {intelligenceDiff && (intelligenceDiff.bids_extracted > 0 || intelligenceDiff.documents_cataloged > 0 || intelligenceDiff.contracts_found > 0 || intelligenceDiff.tasks_created > 0) && (
        <Card className="animate-fade-in border-primary/20 bg-primary/[0.02]" style={{ animationDelay: '275ms' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Since Yesterday
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {intelligenceDiff.runs_since} scan{intelligenceDiff.runs_since !== 1 ? 's' : ''} ·{' '}
                {intelligenceDiff.total_files_processed} file{intelligenceDiff.total_files_processed !== 1 ? 's' : ''} processed
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-3">
              {intelligenceDiff.bids_extracted > 0 && (
                <Link href="/bids" className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {intelligenceDiff.bids_extracted} bid{intelligenceDiff.bids_extracted !== 1 ? 's' : ''} extracted
                </Link>
              )}
              {intelligenceDiff.documents_cataloged > 0 && (
                <Link href="/documents" className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80">
                  <FileText className="h-3.5 w-3.5" />
                  {intelligenceDiff.documents_cataloged} doc{intelligenceDiff.documents_cataloged !== 1 ? 's' : ''} cataloged
                </Link>
              )}
              {intelligenceDiff.contracts_found > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  <Gavel className="h-3.5 w-3.5" />
                  {intelligenceDiff.contracts_found} contract{intelligenceDiff.contracts_found !== 1 ? 's' : ''} found
                </span>
              )}
              {intelligenceDiff.invoices_created > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  <DollarSign className="h-3.5 w-3.5" />
                  {intelligenceDiff.invoices_created} invoice{intelligenceDiff.invoices_created !== 1 ? 's' : ''} created
                </span>
              )}
              {intelligenceDiff.tasks_created > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                  <ListTodo className="h-3.5 w-3.5" />
                  {intelligenceDiff.tasks_created} task{intelligenceDiff.tasks_created !== 1 ? 's' : ''} created
                </span>
              )}
            </div>
            {intelligenceDiff.items.length > 0 && (
              <div className="space-y-1">
                {intelligenceDiff.items.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate mr-2">{item.title}</span>
                    {item.amount != null && item.amount > 0 && (
                      <span className="shrink-0 font-medium">${item.amount.toLocaleString()}</span>
                    )}
                  </div>
                ))}
                {intelligenceDiff.items.length > 5 && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    +{intelligenceDiff.items.length - 5} more items
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Data Integrity Score ── */}
      {integrityScore !== undefined && integrityScore !== null && (
        <div className="animate-fade-in" style={{ animationDelay: '290ms' }}>
          <IntegrityScoreCard
            score={integrityScore}
            issueCount={integrityIssueCount}
            criticalCount={integrityCriticalCount}
            highCount={integrityHighCount}
            lastRunAt={integrityLastRunAt}
          />
        </div>
      )}

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

      {/* ── Draft Email Review Dialog ── */}
      <Dialog open={!!activeDraft && !editingDraft} onOpenChange={(open) => { if (!open) { setActiveDraft(null); setDraftSourceTaskId(null) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Review Draft Email
            </DialogTitle>
            <DialogDescription>AI-generated draft for your review</DialogDescription>
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
                <div className="text-xs text-primary/80 italic">{activeDraft.reason}</div>
              )}
              <div className="border rounded p-3 bg-white text-sm max-h-64 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: activeDraft.body }} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setActiveDraft(null); setDraftSourceTaskId(null) }}>
              <X className="h-3 w-3 mr-1" />Dismiss
            </Button>
            <Button variant="outline" onClick={() => setEditingDraft(activeDraft)}>
              <Edit3 className="h-3 w-3 mr-1" />Edit
            </Button>
            <Button onClick={() => activeDraft && handleSendDraft(activeDraft)} disabled={sendingDraft}>
              {sendingDraft ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Draft Dialog ── */}
      <Dialog open={!!editingDraft} onOpenChange={(open) => { if (!open) setEditingDraft(null) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />Edit Draft Email
            </DialogTitle>
            <DialogDescription>Modify before sending</DialogDescription>
          </DialogHeader>
          {editingDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dash-draft-to">To</Label>
                <Input id="dash-draft-to" value={editingDraft.to} onChange={e => setEditingDraft({ ...editingDraft, to: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-draft-subject">Subject</Label>
                <Input id="dash-draft-subject" value={editingDraft.subject} onChange={e => setEditingDraft({ ...editingDraft, subject: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dash-draft-body">Body (HTML)</Label>
                <Textarea id="dash-draft-body" value={editingDraft.body} onChange={e => setEditingDraft({ ...editingDraft, body: e.target.value })} rows={12} className="font-mono text-xs" />
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
            <Button variant="outline" onClick={() => setEditingDraft(null)}>Cancel</Button>
            <Button onClick={() => editingDraft && handleSendDraft(editingDraft)} disabled={sendingDraft}>
              {sendingDraft ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
