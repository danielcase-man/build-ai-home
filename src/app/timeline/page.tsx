import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import { getTimelineData } from '@/lib/timeline-service'
import TimelineClient from './TimelineClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function TimelineData() {
  const project = await getProject()

  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const tasks = await getTimelineData(project.id)

  return <TimelineClient tasks={tasks} />
}

export default function TimelinePage() {
  return (
    <Suspense fallback={
      <div className="container max-w-7xl py-8">
        <LoadingSpinner message="Loading timeline..." />
      </div>
    }>
      <TimelineData />
    </Suspense>
  )
}
