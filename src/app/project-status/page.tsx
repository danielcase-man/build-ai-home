import { Suspense } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { getProject, calculateCurrentStep } from '@/lib/project-service'
import { getLocalPushableItems } from '@/lib/jobtread-push'
import { env } from '@/lib/env'
import StatusQuickStats from './StatusQuickStats'
import StatusContentCards from './StatusContentCards'
import StatusActionItems from './StatusActionItems'
import StatusCommunications from './StatusCommunications'
import StatusBudget from './StatusBudget'
import StatusGenerateButton from './StatusGenerateButton'
import ExportButton from './ExportButton'
import SectionSkeleton from './SectionSkeleton'
import JobTreadPushPanel from '@/components/JobTreadPushPanel'

// --- Async data-fetching server components ---

async function QuickStats() {
  const project = await getProject()
  if (!project) return null

  const [{ data: planningSteps }, { data: budgetItems }, { data: nextMilestone }] = await Promise.all([
    supabase.from('planning_phase_steps').select('step_number, status').eq('project_id', project.id).order('step_number', { ascending: true }),
    supabase.from('budget_items').select('actual_cost').eq('project_id', project.id),
    supabase.from('milestones').select('name, target_date').eq('project_id', project.id).in('status', ['pending', 'in_progress']).order('target_date', { ascending: true }).limit(1),
  ])

  const { currentStep, totalSteps } = calculateCurrentStep(planningSteps)
  const budgetUsed = budgetItems?.reduce((sum, item) => sum + (parseFloat(item.actual_cost) || 0), 0) || 0
  const budgetTotal = parseFloat(project.budget_total) || 450000
  const createdAt = new Date(project.created_at)
  const daysElapsed = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
  const totalDays = project.estimated_duration_days || 117

  return (
    <StatusQuickStats
      phase={project.phase || 'Planning'}
      currentStep={currentStep}
      totalSteps={totalSteps}
      daysElapsed={daysElapsed}
      totalDays={totalDays}
      budgetStatus={budgetUsed <= budgetTotal ? 'On Track' : 'Over Budget'}
      nextMilestone={nextMilestone?.[0]?.name || 'TBD'}
      progressPercentage={Math.round((currentStep / totalSteps) * 100)}
    />
  )
}

async function StatusContent() {
  const project = await getProject()
  if (!project) return null

  const { data: statusRecord } = await supabase
    .from('project_status')
    .select('*')
    .eq('project_id', project.id)
    .order('date', { ascending: false })
    .limit(1)

  const latestStatus = statusRecord?.[0]

  // Normalize hot_topics: handle both string[] and {priority, text}[] from DB
  const rawTopics = (latestStatus?.hot_topics || []) as Array<string | { priority: string; text: string }>
  const hotTopics = rawTopics.map(t =>
    typeof t === 'string' ? { priority: 'medium', text: t } : t
  )

  // Normalize action_items: handle both string[] and object[] from DB
  const rawActions = (latestStatus?.action_items || []) as Array<string | { status: string; text: string; action_type?: 'draft_email' | null; action_context?: { to?: string; to_name?: string; subject_hint?: string; context?: string } }>
  const actionItems = rawActions.map(a =>
    typeof a === 'string' ? { status: 'pending', text: a } : a
  )

  // Normalize recent_decisions: handle both string[] and {decision, impact}[] from DB
  const rawDecisions = (latestStatus?.recent_decisions || []) as Array<string | { decision: string; impact: string }>
  const recentDecisions = rawDecisions.map(d =>
    typeof d === 'string' ? { decision: d, impact: 'noted' } : d
  )

  const aiSummary = latestStatus?.ai_summary || 'No data yet. Click "Run Intelligence" to scan all sources and generate insights.'

  // Normalize next_steps, open_questions, key_data_points
  const nextSteps = (latestStatus?.next_steps || []) as string[]
  const openQuestions = (latestStatus?.open_questions || []) as Array<{ question: string; askedBy: string; needsResponseFrom?: string }>
  const keyDataPoints = (latestStatus?.key_data_points || []) as Array<{ category: string; data: string; importance: string }>

  return (
    <>
      <StatusContentCards
        hotTopics={hotTopics}
        recentDecisions={recentDecisions}
        aiSummary={aiSummary}
        nextSteps={nextSteps}
        openQuestions={openQuestions}
        keyDataPoints={keyDataPoints}
      />
      <StatusActionItems items={actionItems} />
    </>
  )
}

async function Communications() {
  const project = await getProject()
  if (!project) return null

  const { data: emails } = await supabase
    .from('emails')
    .select('sender_name, ai_summary')
    .eq('project_id', project.id)
    .order('received_date', { ascending: false })
    .limit(5)

  const comms = (emails || []).map(e => ({
    from: e.sender_name || 'Unknown',
    summary: e.ai_summary || 'No summary available'
  }))

  return <StatusCommunications communications={comms} />
}

async function BudgetData() {
  const project = await getProject()
  if (!project) return null

  const { data: budgetItems } = await supabase
    .from('budget_items')
    .select('estimated_cost, actual_cost')
    .eq('project_id', project.id)

  const budgetUsed = budgetItems?.reduce((sum, item) => sum + (parseFloat(item.actual_cost) || 0), 0) || 0
  const budgetTotal = parseFloat(project.budget_total) || 450000
  const contingencyRemaining = Math.max(0, budgetTotal * 0.05 - Math.max(0, budgetUsed - budgetTotal * 0.95))

  return <StatusBudget budgetUsed={budgetUsed} budgetTotal={budgetTotal} contingencyRemaining={contingencyRemaining} />
}

async function JobTreadPush() {
  if (!env.jobtreadApiKey) return null

  const project = await getProject()
  if (!project) return null

  const pushableItems = await getLocalPushableItems(project.id)
  if (pushableItems.length === 0) return null

  return <JobTreadPushPanel items={pushableItems} />
}

async function IntelligenceFooter() {
  const { data: latestRun } = await supabase
    .from('intelligence_runs')
    .select('completed_at, changes_detected, agents_invoked, duration_ms, status')
    .order('created_at', { ascending: false })
    .limit(1)

  const run = latestRun?.[0]

  return (
    <div className="text-center py-4 text-xs text-muted-foreground space-y-1">
      {run?.completed_at ? (
        <>
          <p>
            Intelligence last ran: {format(new Date(run.completed_at), 'MMM d, h:mm a')}
            {run.changes_detected > 0 && ` — ${run.changes_detected} changes processed`}
            {run.duration_ms && ` (${(run.duration_ms / 1000).toFixed(1)}s)`}
          </p>
          <p>
            {run.status === 'completed' ? 'All sources current' : 'Partial — some sources had errors'}
            {' · '}Data updates automatically via daily cron
          </p>
        </>
      ) : (
        <p>Intelligence engine ready. Click &quot;Run Intelligence&quot; to scan all sources.</p>
      )}
    </div>
  )
}

// --- Main page with streaming layout ---

export default function ProjectStatusPage() {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Instant: static header with generate button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Status Report</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton href="/api/export/status-report" label="Export PDF" />
          <StatusGenerateButton />
        </div>
      </div>

      {/* Stream 1: Quick stats */}
      <Suspense fallback={<SectionSkeleton type="stats" />}>
        <QuickStats />
      </Suspense>

      {/* Stream 2: Hot topics, action items, decisions, AI summary */}
      <Suspense fallback={<SectionSkeleton type="cards" />}>
        <StatusContent />
      </Suspense>

      {/* Stream 3: Push to JobTread */}
      <Suspense fallback={<SectionSkeleton type="card" />}>
        <JobTreadPush />
      </Suspense>

      {/* Stream 4: Communications */}
      <Suspense fallback={<SectionSkeleton type="card" />}>
        <Communications />
      </Suspense>

      {/* Stream 4: Budget */}
      <Suspense fallback={<SectionSkeleton type="card" />}>
        <BudgetData />
      </Suspense>

      {/* Instant: footer */}
      <Suspense fallback={null}>
        <IntelligenceFooter />
      </Suspense>
    </div>
  )
}
