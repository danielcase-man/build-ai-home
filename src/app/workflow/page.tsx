import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import { getWorkflowOverview, getPhaseChecklist, getActivePhase, ensureWorkflowInitialized } from '@/lib/workflow-service'
import WorkflowClient from './WorkflowClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function WorkflowData() {
  const project = await getProject()

  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  // Ensure knowledge states are initialized for this project
  await ensureWorkflowInitialized(project.id)

  // Get overview (phases, stats, alerts) and active phase tree
  const overview = await getWorkflowOverview(project.id)

  // Get the detailed tree for the active phase (or first phase)
  const activePhase = await getActivePhase(project.id)
  const activePhaseNumber = activePhase?.phase_number || 1

  // Fetch tree for all phases that have activity, plus the active one
  const activePhases = overview.phases
    .filter(p => p.status === 'active' || p.phase_number === activePhaseNumber)
    .map(p => p.phase_number)

  // Also include the next not_started phase
  const nextPhase = overview.phases.find(p => p.status === 'not_started')
  if (nextPhase && !activePhases.includes(nextPhase.phase_number)) {
    activePhases.push(nextPhase.phase_number)
  }

  // Fetch phase trees in parallel
  const phaseTrees = await Promise.all(
    activePhases.map(pn => getPhaseChecklist(project.id, pn))
  )

  // Flatten all phase trees into a single array
  const phaseTree = phaseTrees.flat()

  return (
    <WorkflowClient
      overview={overview}
      phaseTree={phaseTree}
      projectId={project.id}
    />
  )
}

export default function WorkflowPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading workflow..." />
      </div>
    }>
      <WorkflowData />
    </Suspense>
  )
}
