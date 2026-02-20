import { supabase } from './supabase'

export interface BudgetItemRecord {
  id: string
  project_id: string
  category: string
  subcategory: string | null
  description: string
  estimated_cost: number | null
  actual_cost: number | null
  vendor_id: string | null
  status: string
  approval_date: string | null
  payment_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export async function getBudgetItems(projectId: string): Promise<BudgetItemRecord[]> {
  const { data, error } = await supabase
    .from('budget_items')
    .select('*')
    .eq('project_id', projectId)
    .order('payment_date', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('Error fetching budget items:', error)
    return []
  }

  return (data || []).map(item => ({
    ...item,
    estimated_cost: item.estimated_cost ? parseFloat(item.estimated_cost) : null,
    actual_cost: item.actual_cost ? parseFloat(item.actual_cost) : null,
  }))
}
