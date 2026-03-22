import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import VendorsClient from './VendorsClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'
import { getVendorsWithContacts } from '@/lib/vendor-service'

async function VendorsData() {
  const project = await getProject()
  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const vendors = await getVendorsWithContacts(project.id)

  return <VendorsClient vendors={vendors} projectId={project.id} />
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
