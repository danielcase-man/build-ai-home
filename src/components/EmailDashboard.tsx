'use client'

import { useState, useEffect } from 'react'
import {
  Target, AlertTriangle, CheckCircle, HelpCircle, ArrowRight, BarChart3,
  ClipboardList, ChevronDown, RefreshCw, FileText
} from 'lucide-react'
import { getPriorityColor, getImportanceBadge, formatEmailDate } from '@/lib/ui-helpers'
import ErrorCard from '@/components/ui/ErrorCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import DraftEmailsPanel from '@/components/DraftEmailsPanel'
import type { DraftEmail, EmailInsights, EmailTriage, EmailRecord, Question, KeyDataPoint } from '@/types'

/** One-click reconnect: clears bad tokens and starts OAuth flow */
function GmailReconnect() {
  const [reconnecting, setReconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReconnect = async () => {
    setReconnecting(true)
    setError(null)
    try {
      // Step 1: Clear broken tokens
      await fetch('/api/gmail/disconnect', { method: 'POST' })

      // Step 2: Start OAuth flow
      const res = await fetch('/api/gmail/auth')
      const data = await res.json()
      const authUrl = data.data?.authUrl ?? data.authUrl
      if (authUrl) {
        window.location.href = authUrl
      } else {
        setError('Failed to start Gmail authentication')
        setReconnecting(false)
      }
    } catch {
      setError('Failed to reconnect Gmail')
      setReconnecting(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          Gmail connection expired. Click below to re-authorize access.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleReconnect} disabled={reconnecting}>
          <RefreshCw className={cn("h-4 w-4 mr-2", reconnecting && "animate-spin")} />
          {reconnecting ? 'Reconnecting...' : 'Reconnect Gmail'}
        </Button>
      </CardContent>
    </Card>
  )
}

interface DisplayEmail {
  id: string
  subject: string
  from: string
  date: string
  body: string
  snippet: string
  insights?: EmailInsights
  triage?: EmailTriage
  aiSummary?: string
}

interface UnifiedStatus {
  hot_topics: Array<{ priority: string; text: string }>
  action_items: Array<{ status: string; text: string; action_type?: 'draft_email' | null; action_context?: { to?: string; to_name?: string; subject_hint?: string; context?: string } }>
  recent_decisions: Array<{ decision: string; impact: string }>
  next_steps: string[]
  open_questions: Question[]
  key_data_points: KeyDataPoint[]
  ai_summary: string
  date: string
}

/** Convert DB EmailRecord to display format */
function toDisplayEmail(email: EmailRecord): DisplayEmail {
  return {
    id: email.message_id,
    subject: email.subject,
    from: email.sender_name ? `${email.sender_name} <${email.sender_email}>` : email.sender_email,
    date: email.received_date,
    body: email.body_text || '',
    snippet: email.body_text?.substring(0, 200) || '',
    aiSummary: email.ai_summary || undefined,
  }
}

interface EmailDashboardProps {
  initialEmails?: EmailRecord[]
  initialStatus?: UnifiedStatus | null
}

export default function EmailDashboard({ initialEmails, initialStatus }: EmailDashboardProps) {
  const [emails, setEmails] = useState<DisplayEmail[]>(
    () => initialEmails?.map(toDisplayEmail) || []
  )
  const [status, setStatus] = useState<UnifiedStatus | null>(initialStatus ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<DraftEmail[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [authFailed, setAuthFailed] = useState(false)

  /** Refresh from Gmail API — only used for manual refresh button */
  const refreshEmails = async () => {
    setRefreshing(true)
    setError(null)

    try {
      const response = await fetch('/api/emails/fetch?refresh=true')
      const data = await response.json()

      if (response.status === 401) {
        setAuthFailed(true)
        setError('Gmail authentication expired. Disconnect and reconnect to fix.')
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch emails')
      }

      const payload = data.data || data
      setEmails(payload.emails || [])
      setStatus(payload.status || null)

      fetchDrafts()
    } catch {
      setError('Failed to refresh emails')
    } finally {
      setRefreshing(false)
    }
  }

  const fetchDrafts = async () => {
    setDraftsLoading(true)
    try {
      const response = await fetch('/api/emails/drafts')
      const data = await response.json()
      if (response.ok && data.data?.drafts) {
        setDrafts(data.data.drafts)
      }
    } catch {
      // Silently ignore — drafts section will remain empty
    } finally {
      setDraftsLoading(false)
    }
  }

  // Fetch drafts on mount (lightweight, doesn't block display)
  useEffect(() => {
    fetchDrafts()
  }, [])

  const toggleEmailExpanded = (emailId: string) => {
    const newExpanded = new Set(expandedEmails)
    if (newExpanded.has(emailId)) {
      newExpanded.delete(emailId)
    } else {
      newExpanded.add(emailId)
    }
    setExpandedEmails(newExpanded)
  }

  if (authFailed && emails.length === 0) {
    return <GmailReconnect />
  }

  if (error && emails.length === 0) {
    return <ErrorCard message={error} onRetry={refreshEmails} />
  }

  return (
    <div className="space-y-6">
      {/* Auth failure with cached data — show reconnect banner */}
      {authFailed && emails.length > 0 && (
        <GmailReconnect />
      )}

      {/* Refresh error (non-blocking when we have cached data) */}
      {error && !authFailed && emails.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error} — showing cached data.</AlertDescription>
        </Alert>
      )}

      {/* Project-Wide Status */}
      {status && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-blue-50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Project Intelligence Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Urgent Matters (high-priority hot topics) */}
            {status.hot_topics.filter(t => t.priority === 'high').length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-bold mb-1">URGENT - Needs Immediate Attention</p>
                  <ul className="space-y-1">
                    {status.hot_topics.filter(t => t.priority === 'high').map((topic, idx) => (
                      <li key={idx} className="text-sm font-medium">• {topic.text}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {/* Action Items */}
              {status.action_items.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-construction-green" />
                      Action Items ({status.action_items.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                    {status.action_items.map((item, idx) => (
                      <div key={idx} className={`text-xs p-2 rounded border ${item.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div className="font-semibold">{item.text}</div>
                        <div className="flex gap-2 mt-1 text-xs opacity-75">
                          <span>Status: {item.status}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Open Questions */}
              {status.open_questions.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-purple-500" />
                      Open Questions ({status.open_questions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                    {status.open_questions.map((q, idx) => (
                      <div key={idx} className="text-xs p-2 bg-purple-50 rounded border border-purple-200">
                        <div className="font-semibold text-purple-900">{q.question}</div>
                        <div className="text-purple-700 mt-1">
                          Asked by: {q.askedBy}
                          {q.needsResponseFrom && ` → Needs response from: ${q.needsResponseFrom}`}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Next Steps */}
              {status.next_steps.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Next Steps ({status.next_steps.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
                      {status.next_steps.map((step, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground">• {step}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Key Data Points */}
              {status.key_data_points.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-construction-blue" />
                      Key Data Points ({status.key_data_points.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
                    {status.key_data_points.map((dp, idx) => (
                      <div key={idx} className="text-xs p-2 bg-muted rounded border">
                        <div className="flex items-start">
                          <span className="mr-2">{getImportanceBadge(dp.importance)}</span>
                          <div className="flex-1">
                            <span className="font-semibold text-muted-foreground">{dp.category}:</span>
                            <span className="ml-1">{dp.data}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Overall Status */}
            {status.ai_summary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Overall Project Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{status.ai_summary}</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI-Recommended Email Drafts */}
      {(draftsLoading || drafts.length > 0) && (
        <DraftEmailsPanel drafts={drafts} loading={draftsLoading} />
      )}

      {/* Individual Emails */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Project Communications
            </CardTitle>
            <Button variant="outline" size="sm" onClick={refreshEmails} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              {refreshing ? 'Syncing...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <p className="text-muted-foreground">No project-related emails in the last 7 days.</p>
          ) : (
            <div className="space-y-3">
              {emails.map((email) => (
                <Collapsible
                  key={email.id}
                  open={expandedEmails.has(email.id)}
                  onOpenChange={() => toggleEmailExpanded(email.id)}
                >
                  <div className={cn(
                    "border rounded-lg transition-all",
                    email.triage?.urgent ? 'border-destructive bg-destructive/5' : 'border-border'
                  )}>
                    <CollapsibleTrigger className="w-full p-4 text-left">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm">{email.subject}</h3>
                            {email.triage && (
                              <Badge
                                variant={
                                  email.triage.priority === 'critical' || email.triage.priority === 'high'
                                    ? 'destructive'
                                    : email.triage.priority === 'medium'
                                      ? 'warning'
                                      : 'secondary'
                                }
                              >
                                {email.triage.priority.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            From: {email.from} • {formatEmailDate(email.date)}
                          </p>
                          {email.triage?.urgent && (
                            <p className="mt-1 text-xs font-semibold text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {email.triage.suggestedAction}
                            </p>
                          )}
                        </div>
                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform shrink-0 ml-2",
                          expandedEmails.has(email.id) && "rotate-180"
                        )} />
                      </div>

                      {/* Quick Summary */}
                      {email.insights?.summary && (
                        <Alert className="mt-3">
                          <AlertDescription className="text-xs">
                            {email.insights.summary}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CollapsibleTrigger>

                    {/* Expanded Insights */}
                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t space-y-3">
                        {/* Action Items */}
                        {email.insights && email.insights.actionItems.length > 0 && (
                          <div className="mt-3">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5 text-construction-green" />
                              Action Items:
                            </h4>
                            <div className="space-y-1">
                              {email.insights.actionItems.map((item, idx) => (
                                <div key={idx} className={`text-xs p-2 rounded ${getPriorityColor(item.priority)}`}>
                                  {item.item}
                                  {item.owner && <span className="ml-2 opacity-75">Owner: {item.owner}</span>}
                                  {item.deadline && <span className="ml-2 opacity-75">Due: {item.deadline}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Questions */}
                        {email.insights && email.insights.questions.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                              <HelpCircle className="h-3.5 w-3.5 text-purple-500" />
                              Questions:
                            </h4>
                            <div className="space-y-1">
                              {email.insights.questions.map((q, idx) => (
                                <div key={idx} className="text-xs p-2 bg-purple-50 rounded">
                                  <div>{q.question}</div>
                                  <div className="text-purple-600 mt-1">
                                    {q.askedBy}{q.needsResponseFrom && ` → ${q.needsResponseFrom}`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Next Steps */}
                        {email.insights && email.insights.nextSteps.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                              <ArrowRight className="h-3.5 w-3.5 text-primary" />
                              Next Steps:
                            </h4>
                            <ul className="text-xs space-y-1">
                              {email.insights.nextSteps.map((step, idx) => (
                                <li key={idx} className="text-muted-foreground">• {step}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Key Data */}
                        {email.insights && email.insights.keyDataPoints.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                              <BarChart3 className="h-3.5 w-3.5 text-construction-blue" />
                              Key Data:
                            </h4>
                            <div className="space-y-1">
                              {email.insights.keyDataPoints.map((dp, idx) => (
                                <div key={idx} className="text-xs bg-muted p-2 rounded flex items-start">
                                  <span className="mr-1">{getImportanceBadge(dp.importance)}</span>
                                  <span className="font-semibold">{dp.category}:</span>
                                  <span className="ml-1">{dp.data}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Email Body */}
                        <div className="mt-3">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            Full Email:
                          </h4>
                          <div className="bg-muted p-3 rounded text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto scrollbar-thin">
                            {email.body || email.snippet}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}

          <div className="mt-4 text-sm text-muted-foreground">
            <p>Last 7 days • {emails.length} email{emails.length !== 1 ? 's' : ''}</p>
            <p className="mt-1">Powered by Claude AI for construction project intelligence</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
