import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import { getSelections } from '@/lib/selections-service'
import SelectionsClient from './SelectionsClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function SelectionsData() {
  const project = await getProject()

  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const selections = await getSelections(project.id)

  return <SelectionsClient initialSelections={selections} />
}

export default function SelectionsPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading selections..." />
      </div>
    }>
      <SelectionsData />
    </Suspense>
  )
}
