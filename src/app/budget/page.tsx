import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import { getBudgetItems } from '@/lib/budget-service'
import BudgetClient from './BudgetClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'

async function BudgetData() {
  const project = await getProject()

  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const items = await getBudgetItems(project.id)

  return <BudgetClient initialItems={items} budgetTotal={parseFloat(project.budget_total) || 1200000} projectStartDate={project.created_at} />
}

export default function BudgetPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading budget data..." />
      </div>
    }>
      <BudgetData />
    </Suspense>
  )
}
