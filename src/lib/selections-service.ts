import { supabase } from './supabase'
import type { Selection } from '@/types'

export async function getSelections(projectId: string): Promise<Selection[]> {
  const { data, error } = await supabase
    .from('selections')
    .select('*')
    .eq('project_id', projectId)
    .order('room', { ascending: true })
    .order('category', { ascending: true })
    .order('subcategory', { ascending: true })

  if (error) {
    console.error('Error fetching selections:', error)
    return []
  }

  return data || []
}

export async function getSelectionsByCategory(
  projectId: string,
  category: string
): Promise<Selection[]> {
  const { data, error } = await supabase
    .from('selections')
    .select('*')
    .eq('project_id', projectId)
    .eq('category', category)
    .order('room', { ascending: true })
    .order('subcategory', { ascending: true })

  if (error) {
    console.error('Error fetching selections by category:', error)
    return []
  }

  return data || []
}

export async function updateSelection(
  id: string,
  updates: Partial<Pick<Selection, 'status' | 'notes' | 'model_number' | 'unit_price' | 'total_price' | 'lead_time' | 'order_date' | 'expected_delivery' | 'product_url'>>
): Promise<Selection | null> {
  const { data, error } = await supabase
    .from('selections')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating selection:', error)
    return null
  }

  return data
}

export async function createSelection(
  selection: Omit<Selection, 'id' | 'created_at' | 'updated_at'>
): Promise<Selection | null> {
  const { data, error } = await supabase
    .from('selections')
    .insert([selection])
    .select()
    .single()

  if (error) {
    console.error('Error creating selection:', error)
    return null
  }

  return data
}
