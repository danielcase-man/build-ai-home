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

  if (error) return []

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

  if (error) return []

  return data || []
}

export async function updateSelection(
  id: string,
  updates: Partial<Pick<Selection, 'status' | 'notes' | 'model_number' | 'unit_price' | 'total_price' | 'lead_time' | 'order_date' | 'expected_delivery' | 'product_url' | 'bid_id'>>
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

export async function linkSelectionToBid(
  selectionId: string,
  bidId: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('selections')
    .update({ bid_id: bidId, updated_at: new Date().toISOString() })
    .eq('id', selectionId)

  if (error) {
    console.error('Error linking selection to bid:', error)
    return false
  }
  return true
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
