import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import AuditClient from './AuditClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'
import { getRecentAuditLog } from '@/lib/audit-service'

async function AuditData() {
  const project = await getProject()
  if (!project) {
    return <ErrorCard message="No project found." />
  }

  const entries = await getRecentAuditLog(project.id, 100)
  return <AuditClient entries={entries} />
}

export default function AuditPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading audit trail..." />
      </div>
    }>
      <AuditData />
    </Suspense>
  )
}
