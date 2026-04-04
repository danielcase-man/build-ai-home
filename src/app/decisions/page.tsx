import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import { getDecisions } from '@/lib/decision-log-service'
import { getSelectionDecisionQueue } from '@/lib/selection-decision-service'
import { supabase } from '@/lib/supabase'
import DecisionsClient from './DecisionsClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function DecisionsData() {
  const project = await getProject()
  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const [decisions, decisionQueue, tasksResult] = await Promise.all([
    getDecisions(project.id),
    getSelectionDecisionQueue(project.id).catch(() => ({
      decisionQueue: [],
      lockedIn: [],
      future: [],
      activePhase: null,
      activePhaseName: null,
    })),
    supabase
      .from('tasks')
      .select('id, title, status')
      .eq('project_id', project.id)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false }),
  ])

  const openTasks = (tasksResult.data || []) as Array<{
    id: string; title: string; status: string
  }>

  return (
    <DecisionsClient
      decisions={decisions}
      decisionQueue={decisionQueue.decisionQueue}
      lockedIn={decisionQueue.lockedIn}
      futureTrades={decisionQueue.future}
      openTasks={openTasks}
      projectId={project.id}
    />
  )
}

export default function DecisionsPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading decisions..." />
      </div>
    }>
      <DecisionsData />
    </Suspense>
  )
}
