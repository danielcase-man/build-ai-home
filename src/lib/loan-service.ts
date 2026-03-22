import { supabase } from './supabase'
import type { ConstructionLoan } from '@/types'

export async function getActiveConstructionLoan(projectId: string): Promise<ConstructionLoan | null> {
  const { data, error } = await supabase
    .from('construction_loans')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  return data as ConstructionLoan
}

// Alias for backward compatibility (used by project-service.ts, ai-summarization)
export const getConstructionLoan = getActiveConstructionLoan

export async function getConstructionLoanHistory(projectId: string): Promise<ConstructionLoan[]> {
  const { data, error } = await supabase
    .from('construction_loans')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', false)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as ConstructionLoan[]
}

export async function deactivateAllLoans(projectId: string): Promise<void> {
  await supabase
    .from('construction_loans')
    .update({ is_active: false })
    .eq('project_id', projectId)
    .eq('is_active', true)
}

export async function upsertConstructionLoan(
  projectId: string,
  loan: Partial<ConstructionLoan> & { _action?: string }
): Promise<{ loan: ConstructionLoan | null; history: ConstructionLoan[] }> {
  const { _action, ...loanData } = loan

  if (_action === 'new_application' || !loanData.id) {
    // New application: deactivate existing, insert fresh
    await deactivateAllLoans(projectId)

    const { data, error } = await supabase
      .from('construction_loans')
      .insert({ ...loanData, project_id: projectId, is_active: true })
      .select()
      .single()

    if (error) {
      console.error('Failed to create construction loan:', error)
      return { loan: null, history: await getConstructionLoanHistory(projectId) }
    }

    return {
      loan: data as ConstructionLoan,
      history: await getConstructionLoanHistory(projectId),
    }
  }

  // Update existing loan by ID
  const { data, error } = await supabase
    .from('construction_loans')
    .update({ ...loanData, project_id: projectId })
    .eq('id', loanData.id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update construction loan:', error)
    return { loan: null, history: await getConstructionLoanHistory(projectId) }
  }

  return {
    loan: data as ConstructionLoan,
    history: await getConstructionLoanHistory(projectId),
  }
}

export async function updateLoanFields(
  loanId: string,
  fields: Partial<ConstructionLoan>
): Promise<ConstructionLoan | null> {
  const { data, error } = await supabase
    .from('construction_loans')
    .update(fields)
    .eq('id', loanId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update loan fields:', error)
    return null
  }
  return data as ConstructionLoan
}
