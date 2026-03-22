import { Suspense } from 'react'
import MobileLayout from '@/components/mobile/MobileLayout'
import { getProject } from '@/lib/project-service'
import { getPunchList } from '@/lib/punch-list-service'
import MobilePunchList from './MobilePunchList'

async function PunchListData() {
  const project = await getProject()
  if (!project) return <div className="p-4 text-center text-gray-500">No project found</div>

  const items = await getPunchList(project.id)
  return <MobilePunchList items={items} projectId={project.id} />
}

export default function MobilePunchListPage() {
  return (
    <MobileLayout title="Punch List">
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      }>
        <PunchListData />
      </Suspense>
    </MobileLayout>
  )
}
