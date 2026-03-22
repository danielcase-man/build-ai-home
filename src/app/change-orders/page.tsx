import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import ChangeOrdersClient from './ChangeOrdersClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'
import { getChangeOrders, getChangeOrderSummary } from '@/lib/change-order-service'

async function ChangeOrdersData() {
  const project = await getProject()
  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const [orders, summary] = await Promise.all([
    getChangeOrders(project.id),
    getChangeOrderSummary(project.id),
  ])

  return <ChangeOrdersClient orders={orders} summary={summary} projectId={project.id} />
}

export default function ChangeOrdersPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading change orders..." />
      </div>
    }>
      <ChangeOrdersData />
    </Suspense>
  )
}
