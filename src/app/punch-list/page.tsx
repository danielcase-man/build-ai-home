import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import PunchListClient from './PunchListClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'
import { getPunchList, getPunchListStats } from '@/lib/punch-list-service'

async function PunchListData() {
  const project = await getProject()
  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const [items, stats] = await Promise.all([
    getPunchList(project.id),
    getPunchListStats(project.id),
  ])

  return <PunchListClient items={items} stats={stats} projectId={project.id} />
}

export default function PunchListPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading punch list..." />
      </div>
    }>
      <PunchListData />
    </Suspense>
  )
}
