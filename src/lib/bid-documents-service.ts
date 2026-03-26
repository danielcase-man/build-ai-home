import { supabase } from './supabase'
import type { BidDocument } from '@/types'

/**
 * Create a bid document record (after file is uploaded to Supabase Storage).
 */
export async function createBidDocument(doc: {
  project_id: string
  filename: string
  file_type: string
  file_size: number
  storage_path: string
  source: 'upload' | 'email_attachment' | 'dropbox'
  email_id?: string
  dropbox_path?: string
}): Promise<BidDocument | null> {
  const { data, error } = await supabase
    .from('bid_documents')
    .insert({
      ...doc,
      extraction_status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating bid document:', error)
    return null
  }
  return data as BidDocument
}

/**
 * Update extraction status and results.
 */
export async function updateExtractionStatus(
  docId: string,
  update: {
    extraction_status: 'processing' | 'completed' | 'failed'
    extracted_text?: string
    ai_confidence?: number
    ai_extraction_notes?: string
    bid_id?: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('bid_documents')
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .eq('id', docId)

  if (error) {
    console.error('Error updating extraction status:', error)
  }
}

/**
 * Get all documents for a project, optionally filtered by status.
 */
export async function getBidDocuments(
  projectId: string,
  status?: string
): Promise<BidDocument[]> {
  let query = supabase
    .from('bid_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('extraction_status', status)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching bid documents:', error)
    return []
  }
  return data || []
}

/**
 * Get documents for a specific bid.
 */
export async function getDocumentsForBid(bidId: string): Promise<BidDocument[]> {
  const { data, error } = await supabase
    .from('bid_documents')
    .select('*')
    .eq('bid_id', bidId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents for bid:', error)
    return []
  }
  return data || []
}

/**
 * Find unprocessed documents that need AI extraction.
 */
export async function getPendingExtractions(projectId: string): Promise<BidDocument[]> {
  const { data, error } = await supabase
    .from('bid_documents')
    .select('*')
    .eq('project_id', projectId)
    .eq('extraction_status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching pending extractions:', error)
    return []
  }
  return data || []
}
