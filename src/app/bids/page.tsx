import { Suspense } from 'react'
import { getBidsForDefaultProject } from '@/lib/bids-service'
import BidsClient from './BidsClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function BidsData() {
  const { projectExists, bids } = await getBidsForDefaultProject()

  if (!projectExists) {
    return <ErrorCard message="No project found. Create a project first." />
  }

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
