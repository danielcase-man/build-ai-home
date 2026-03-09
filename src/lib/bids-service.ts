import { cache } from 'react'
import { supabase } from './supabase'
import type { Bid } from '@/types'

// Columns needed by BidsClient for display
const BID_SELECT_COLUMNS = [
  'id',
  'vendor_name',
  'vendor_contact',
  'vendor_email',
  'vendor_phone',
  'category',
  'subcategory',
  'description',
  'total_amount',
  'scope_of_work',
  'payment_terms',
  'lead_time_weeks',
  'status',
  'bid_date',
  'internal_notes',
  'pros',
  'cons',
].join(',')

export async function getBids(projectId: string): Promise<Bid[]> {
  const { data, error } = await supabase
    .from('bids')
    .select(BID_SELECT_COLUMNS)
    .eq('project_id', projectId)
    .order('category', { ascending: true })
    .order('total_amount', { ascending: true })

  if (error) {
    // Silently return empty — RLS or auth errors are expected without a session
    return []
  }

  return (data || []) as unknown as Bid[]
}

/**
 * Fetches project ID (minimal query) then bids in sequence, but avoids
 * the full getProject() overhead by only selecting the id column.
 * Cached per request via React cache().
 */
export const getBidsForDefaultProject = cache(async (): Promise<{
  projectExists: boolean
  bids: Bid[]
}> => {
  // Minimal project lookup — only fetch the id column
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (projectError || !project) {
    return { projectExists: false, bids: [] }
  }

  const { data, error } = await supabase
    .from('bids')
    .select(BID_SELECT_COLUMNS)
    .eq('project_id', project.id)
    .order('category', { ascending: true })
    .order('total_amount', { ascending: true })

  if (error) {
    // Silently return empty — RLS or auth errors are expected without a session
    return { projectExists: true, bids: [] }
  }

  return { projectExists: true, bids: (data || []) as unknown as Bid[] }
})
