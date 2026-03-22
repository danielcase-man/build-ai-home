import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import WarrantiesClient from './WarrantiesClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'
import { getWarranties, getComplianceGaps, getCompliance } from '@/lib/warranty-service'

async function WarrantiesData() {
  const project = await getProject()
  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const [warranties, compliance, gaps] = await Promise.all([
    getWarranties(project.id),
    getCompliance(project.id),
    getComplianceGaps(project.id),
  ])

  return (
    <WarrantiesClient
      warranties={warranties}
      compliance={compliance}
      complianceGaps={gaps}
      projectId={project.id}
    />
  )
}

export default function WarrantiesPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading warranties..." />
      </div>
    }>
      <WarrantiesData />
    </Suspense>
  )
}
