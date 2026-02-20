import { supabase } from './supabase'
import type { Bid } from '@/types'

export async function getBids(projectId: string): Promise<Bid[]> {
  const { data, error } = await supabase
    .from('bids')
    .select('*')
    .eq('project_id', projectId)
    .order('category', { ascending: true })
    .order('total_amount', { ascending: true })

  if (error) {
    console.error('Error fetching bids:', error)
    return []
  }

  return data || []
}
