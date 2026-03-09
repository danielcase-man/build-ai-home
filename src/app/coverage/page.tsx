import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import { getBids } from '@/lib/bids-service'
import { getBudgetItems } from '@/lib/budget-service'
import CoverageClient from './CoverageClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function CoverageData() {
  const project = await getProject()

  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const [bids, budgetItems] = await Promise.all([
    getBids(project.id),
    getBudgetItems(project.id),
  ])

  return <CoverageClient bids={bids} budgetItems={budgetItems} />
}

export default function CoveragePage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading coverage data..." />
      </div>
    }>
      <CoverageData />
    </Suspense>
  )
}
