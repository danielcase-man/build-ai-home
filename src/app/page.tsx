import { Suspense } from 'react'
import { getProjectDashboard, getProject, getActiveHotTopics } from '@/lib/project-service'
import HomeClient from './HomeClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Mail, Calendar, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Progress skeleton */}
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16 mt-1" /><Skeleton className="h-3 w-20 mt-1" /></CardContent></Card>
        ))}
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><Skeleton className="h-6 w-32" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
      </div>
    </div>
  )
}

async function DashboardData() {
  const project = await getProject()

  const [dashboardData, hotTopics] = await Promise.all([
    getProjectDashboard(),
    project?.id ? getActiveHotTopics(project.id) : Promise.resolve([]),
  ])

  return <HomeClient initialData={dashboardData} initialHotTopics={hotTopics} />
}

export default function HomePage() {
  return (
    <div className="container py-8 space-y-6">
      {/* Instant: Quick Actions render immediately */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
              <Link href="/emails">
                <Mail className="h-6 w-6" />
                <span className="text-sm">View Emails</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
              <Link href="/project-status">
                <FileText className="h-6 w-6" />
                <span className="text-sm">Project Status</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
              <Link href="/budget">
                <DollarSign className="h-6 w-6" />
                <span className="text-sm">Budget Details</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" asChild>
              <Link href="/bids">
                <Calendar className="h-6 w-6" />
                <span className="text-sm">View Bids</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stream: Data-driven content loads in background */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData />
      </Suspense>
    </div>
  )
}
