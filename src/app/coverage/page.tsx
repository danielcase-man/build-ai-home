import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import { getBids } from '@/lib/bids-service'
import { getBudgetItems } from '@/lib/budget-service'
import { getSelections } from '@/lib/selections-service'
import { getProjectCoverageSummary } from '@/lib/coverage-scoring-service'
import CoverageClient from './CoverageClient'
import CoverageMatrixClient, { CoverageMatrixSkeleton } from './CoverageMatrixClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function CoverageData() {
  const project = await getProject()

  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const [bids, budgetItems, selections] = await Promise.all([
    getBids(project.id),
    getBudgetItems(project.id),
    getSelections(project.id),
  ])

  return <CoverageClient bids={bids} budgetItems={budgetItems} selections={selections} />
}

async function CoverageMatrixData() {
  const project = await getProject()

  if (!project) {
    return null // Error already shown by CoverageData above
  }

  // Fetch coverage summaries — returns [] if no takeoff runs exist
  const summaries = await getProjectCoverageSummary(project.id)

  return <CoverageMatrixClient summaries={summaries} projectId={project.id} />
}

export default function CoveragePage() {
  return (
    <>
      <Suspense fallback={
        <div className="container max-w-6xl py-8">
          <LoadingSpinner message="Loading coverage data..." />
        </div>
      }>
        <CoverageData />
      </Suspense>

      {/* Item-level coverage matrix — below the trade-level overview */}
      <Suspense fallback={
        <div className="container max-w-6xl py-2 pb-8">
          <CoverageMatrixSkeleton />
        </div>
      }>
        <div className="container max-w-6xl py-2 pb-8">
          <CoverageMatrixData />
        </div>
      </Suspense>
    </>
  )
}
