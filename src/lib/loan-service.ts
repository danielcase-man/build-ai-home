import { supabase } from './supabase'
import type { ConstructionLoan } from '@/types'

export async function getConstructionLoan(projectId: string): Promise<ConstructionLoan | null> {
  const { data, error } = await supabase
    .from('construction_loans')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error || !data) return null
  return data as ConstructionLoan
}

export async function upsertConstructionLoan(
  projectId: string,
  loan: Partial<ConstructionLoan>
): Promise<ConstructionLoan | null> {
  const { data, error } = await supabase
    .from('construction_loans')
    .upsert(
      { ...loan, project_id: projectId },
      { onConflict: 'project_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Failed to upsert construction loan:', error)
    return null
  }
  return data as ConstructionLoan
}
