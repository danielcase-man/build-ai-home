import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import { getBids } from '@/lib/bids-service'
import BidsClient from './BidsClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function BidsData() {
  const project = await getProject()

  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const bids = await getBids(project.id)

  return <BidsClient bids={bids} />
}

export default function BidsPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading bids..." />
      </div>
    }>
      <BidsData />
    </Suspense>
  )
}
