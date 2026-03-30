import { Suspense } from 'react'
import { getProjectDashboard, getProject } from '@/lib/project-service'
import { db } from '@/lib/database'
import { getFollowUpsNeeded } from '@/lib/vendor-thread-service'
import { getBids } from '@/lib/bids-service'
import { getSelections } from '@/lib/selections-service'
import { CONSTRUCTION_PHASES } from '@/lib/construction-phases'
import { getLeadTimeAlerts } from '@/lib/construction-expertise'
import { getIntelligenceDiff } from '@/lib/intelligence-diff'
import HomeClient from './HomeClient'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64 mt-1.5" />
      </div>
      {/* Attention feed skeleton */}
      <Card>
        <div className="px-6 py-4 border-b">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="divide-y">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-6 py-3">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </Card>
      {/* Progress + stats skeleton */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-2.5">
                <Skeleton className="h-3 w-12 mb-1.5" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><Skeleton className="h-5 w-36" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-5 w-44" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
      </div>
    </div>
  )
}

async function DashboardData() {
  const project = await getProject()

  const [dashboardData, latestStatus, emailPreviews, hasGmailAuth, deadlines, vendorFollowUps, bids, selections, intelligenceDiff] = await Promise.all([
    getProjectDashboard(),
    project?.id ? db.getLatestProjectStatus(project.id) : Promise.resolve(null),
    db.getRecentEmailPreviews(3),
    db.hasEmailAccountConfigured(),
    project?.id ? db.getUpcomingDeadlines(project.id) : Promise.resolve([]),
    project?.id ? getFollowUpsNeeded(project.id, 5).catch(() => []) : Promise.resolve([]),
    project?.id ? getBids(project.id).catch(() => []) : Promise.resolve([]),
    project?.id ? getSelections(project.id).catch(() => []) : Promise.resolve([]),
    project?.id ? getIntelligenceDiff(project.id).catch(() => null) : Promise.resolve(null),
  ])

  // Compute coverage gaps: trades that have zero bids
  const bidCategories = new Set(bids.map(b => b.category))
  const allTrades = CONSTRUCTION_PHASES.flatMap(p => p.trades)
  const uncoveredTrades = allTrades
    .filter(t => t.required && !bidCategories.has(t.bidCategory))
    .map(t => ({ name: t.name, phase: CONSTRUCTION_PHASES.find(p => p.trades.includes(t))?.name || '' }))

  // Lead time alerts: long-lead items missing selections or bids
  const leadTimeAlerts = getLeadTimeAlerts(
    selections.map(s => ({ category: s.category, status: s.status })),
    bids.map(b => ({ category: b.category, status: b.status })),
  )

  return (
    <HomeClient
      initialData={dashboardData}
      initialStatus={latestStatus}
      initialEmails={emailPreviews}
      gmailConnected={hasGmailAuth}
      initialDeadlines={deadlines}
      vendorFollowUps={vendorFollowUps.map(f => ({
        vendorName: f.thread.vendor_name,
        daysWaiting: f.days_waiting,
        reason: f.reason,
        category: f.thread.category,
      }))}
      coverageGaps={uncoveredTrades.slice(0, 5)}
      leadTimeAlerts={leadTimeAlerts}
      intelligenceDiff={intelligenceDiff}
    />
  )
}

export default function HomePage() {
  return (
    <div className="container py-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData />
      </Suspense>
    </div>
  )
}
