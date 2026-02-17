import { Suspense } from 'react'
import { getProjectDashboard, getProject, getActiveHotTopics } from '@/lib/project-service'
import HomeClient from './HomeClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

async function DashboardData() {
  const [dashboardData, project] = await Promise.all([
    getProjectDashboard(),
    getProject()
  ])

  let hotTopics: string[] = []
  if (project?.id) {
    hotTopics = await getActiveHotTopics(project.id)
  }

  return <HomeClient initialData={dashboardData} initialHotTopics={hotTopics} />
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="container py-8">
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    }>
      <DashboardData />
    </Suspense>
  )
}
