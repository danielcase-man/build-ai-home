import { Suspense } from 'react'
import { getProject } from '@/lib/project-service'
import DocumentsClient from './DocumentsClient'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorCard from '@/components/ui/ErrorCard'
import { supabase } from '@/lib/supabase'

interface Document {
  id: string
  project_id: string
  name: string
  file_url: string | null
  file_type: string | null
  file_size: number | null
  category: string | null
  description: string | null
  upload_date: string | null
  jobtread_id: string | null
  created_at: string
}

async function DocumentsData() {
  const project = await getProject()
  if (!project) {
    return <ErrorCard message="No project found. Create a project first." />
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', project.id)
    .order('upload_date', { ascending: false })

  return <DocumentsClient documents={(documents || []) as Document[]} projectId={project.id} />
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-6xl py-8">
        <LoadingSpinner message="Loading documents..." />
      </div>
    }>
      <DocumentsData />
    </Suspense>
  )
}
