import { supabase } from './supabase'
import type { BidLineItem, ExtractedLineItem } from '@/types'

/**
 * Get all line items for a bid.
 */
export async function getBidLineItems(bidId: string): Promise<BidLineItem[]> {
  const { data, error } = await supabase
    .from('bid_line_items')
    .select('*')
    .eq('bid_id', bidId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching bid line items:', error)
    return []
  }
  return data || []
}

/**
 * Get all line items for a category across all bids in a project.
 * Used for vendor comparison views.
 */
export async function getLineItemsByCategory(
  projectId: string,
  category: string
): Promise<(BidLineItem & { vendor_name: string; bid_status: string })[]> {
  const { data, error } = await supabase
    .from('bid_line_items')
    .select(`
      *,
      bids!inner(vendor_name, status, project_id)
    `)
    .eq('bids.project_id', projectId)
    .eq('category', category)
    .order('room', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching line items by category:', error)
    return []
  }

  return (data || []).map((row: Record<string, unknown>) => {
    const bids = row.bids as Record<string, unknown>
    const { bids: _, ...lineItem } = row
    return {
      ...lineItem,
      vendor_name: bids.vendor_name as string,
      bid_status: bids.status as string,
    } as BidLineItem & { vendor_name: string; bid_status: string }
  })
}

/**
 * Create line items from AI extraction results.
 */
export async function createLineItemsFromExtraction(
  bidId: string,
  items: ExtractedLineItem[],
  bidCategory?: string
): Promise<BidLineItem[]> {
  if (items.length === 0) return []

  const rows = items.map((item, idx) => ({
    bid_id: bidId,
    item_name: item.item_name,
    item_description: item.item_description || null,
    specs: item.specs || null,
    room: item.room || null,
    quantity: item.quantity || 1,
    unit: item.unit || null,
    unit_price: item.unit_price || null,
    total_price: item.total_price,
    brand: item.brand || null,
    model_number: item.model_number || null,
    finish: item.finish || null,
    color: item.color || null,
    material: item.material || null,
    category: item.category || bidCategory || null,
    subcategory: item.subcategory || null,
    notes: item.notes || null,
    sort_order: idx,
  }))

  const { data, error } = await supabase
    .from('bid_line_items')
    .insert(rows)
    .select()

  if (error) {
    console.error('Error creating bid line items:', error)
    return []
  }
  return data || []
}

/**
 * Delete all line items for a bid (used before re-extraction).
 */
export async function deleteLineItemsForBid(bidId: string): Promise<void> {
  const { error } = await supabase
    .from('bid_line_items')
    .delete()
    .eq('bid_id', bidId)

  if (error) {
    console.error('Error deleting bid line items:', error)
  }
}

/**
 * Link a line item to a selection (when vendor is selected).
 */
export async function linkLineItemToSelection(
  lineItemId: string,
  selectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('bid_line_items')
    .update({ selection_id: selectionId, updated_at: new Date().toISOString() })
    .eq('id', lineItemId)

  if (error) {
    console.error('Error linking line item to selection:', error)
  }
}

/**
 * Get vendor comparison summary for all categories in a project.
 */
export async function getVendorComparisons(projectId: string): Promise<
  Array<{
    category: string
    vendor_count: number
    bids: Array<{
      bid_id: string
      vendor_name: string
      total_amount: number
      status: string
      line_item_count: number
      lead_time_weeks: number | null
    }>
  }>
> {
  const { data: bids, error } = await supabase
    .from('bids')
    .select('id, vendor_name, category, total_amount, status, lead_time_weeks')
    .eq('project_id', projectId)
    .order('category')
    .order('total_amount')

  if (error || !bids) return []

  // Get line item counts per bid
  const { data: counts } = await supabase
    .from('bid_line_items')
    .select('bid_id')

  const countMap = new Map<string, number>()
  if (counts) {
    for (const row of counts) {
      countMap.set(row.bid_id, (countMap.get(row.bid_id) || 0) + 1)
    }
  }

  // Group by category
  const byCategory = new Map<string, typeof bids>()
  for (const bid of bids) {
    const list = byCategory.get(bid.category) || []
    list.push(bid)
    byCategory.set(bid.category, list)
  }

  return Array.from(byCategory.entries()).map(([category, categoryBids]) => ({
    category,
    vendor_count: categoryBids.length,
    bids: categoryBids.map(b => ({
      bid_id: b.id,
      vendor_name: b.vendor_name,
      total_amount: b.total_amount,
      status: b.status,
      line_item_count: countMap.get(b.id) || 0,
      lead_time_weeks: b.lead_time_weeks,
    })),
  }))
}
