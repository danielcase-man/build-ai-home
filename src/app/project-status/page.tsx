import { Suspense } from 'react'
import { getProjectStatus } from '@/lib/project-service'
import ProjectStatusClient from './ProjectStatusClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function ProjectStatusData() {
  const statusData = await getProjectStatus()

  if (!statusData) {
    return <ErrorCard message="No project data available. Create a project first." />
  }

  return <ProjectStatusClient initialData={statusData} />
}

export default function ProjectStatusPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-4xl py-8">
        <LoadingSpinner message="Loading project status..." />
      </div>
    }>
      <ProjectStatusData />
    </Suspense>
  )
}
