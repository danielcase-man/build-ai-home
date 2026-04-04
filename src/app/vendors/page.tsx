import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import VendorsClient from './VendorsClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'
import { getVendorsWithContacts, getProjectContacts } from '@/lib/vendor-service'
import { getVendorInvitations } from '@/lib/vendor-invitation-service'
import { getVendorThreads, getFollowUpsNeeded } from '@/lib/vendor-thread-service'
import { getBids } from '@/lib/bids-service'

async function VendorsData() {
  const project = await getProject()
  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const [vendors, invitations, contacts, threads, followUps, bids] = await Promise.all([
    getVendorsWithContacts(project.id),
    getVendorInvitations(project.id).catch(() => []),
    getProjectContacts(project.id),
    getVendorThreads(project.id).catch(() => []),
    getFollowUpsNeeded(project.id, 5).catch(() => []),
    getBids(project.id).catch(() => []),
  ])

  return <VendorsClient vendors={vendors} invitations={invitations} contacts={contacts} projectId={project.id} threads={threads} followUps={followUps} bids={bids} />
}

export default function VendorsPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading vendors..." />
      </div>
    }>
      <VendorsData />
    </Suspense>
  )
}
