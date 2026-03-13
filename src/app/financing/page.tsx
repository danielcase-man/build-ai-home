import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import { getConstructionLoan } from '@/lib/loan-service'
import FinancingClient from './FinancingClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function FinancingData() {
  const project = await getProject()

  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const loan = await getConstructionLoan(project.id)

  return <FinancingClient loan={loan} projectId={project.id} />
}

export default function FinancingPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-5xl py-8">
        <LoadingSpinner message="Loading financing details..." />
      </div>
    }>
      <FinancingData />
    </Suspense>
  )
}
