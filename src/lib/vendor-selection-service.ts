import { supabase } from './supabase'
import { getBidLineItems } from './bid-line-items-service'
import type { BidLineItem, Selection } from '@/types'

/**
 * Select a vendor for a category: creates selections from all their bid line items,
 * rejects competing bids, and marks old manual selections as alternatives.
 */
export async function selectVendorForCategory(
  projectId: string,
  bidId: string
): Promise<{ selections_created: number; error?: string }> {
  // Get the bid
  const { data: bid, error: bidError } = await supabase
    .from('bids')
    .select('id, vendor_name, vendor_id, category, total_amount')
    .eq('id', bidId)
    .single()

  if (bidError || !bid) {
    return { selections_created: 0, error: 'Bid not found' }
  }

  // Get the bid's line items
  const lineItems = await getBidLineItems(bidId)

  // If no line items, create a single selection from the bid itself
  const itemsToCreate = lineItems.length > 0
    ? lineItems
    : [{
        id: '',
        bid_id: bidId,
        item_name: bid.vendor_name + ' — ' + bid.category,
        room: 'Whole House',
        quantity: 1,
        total_price: bid.total_amount,
        category: bid.category,
        sort_order: 0,
      } as BidLineItem]

  // Mark existing manual selections in this category as 'alternative'
  await supabase
    .from('selections')
    .update({ status: 'alternative', updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('category', mapBidCategoryToSelectionCategory(bid.category))
    .eq('source', 'manual')
    .in('status', ['considering', 'selected'])

  // Mark existing bid-imported selections in this category as 'alternative'
  await supabase
    .from('selections')
    .update({ status: 'alternative', updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('category', mapBidCategoryToSelectionCategory(bid.category))
    .eq('source', 'bid_import')
    .in('status', ['considering', 'selected'])

  // Create new selections from line items
  const selectionRows = itemsToCreate.map(item => ({
    project_id: projectId,
    product_name: item.item_name,
    room: item.room || 'Whole House',
    category: mapBidCategoryToSelectionCategory(item.category || bid.category),
    subcategory: item.subcategory || null,
    brand: item.brand || null,
    model_number: item.model_number || null,
    finish: item.finish || null,
    color: item.color || null,
    material: item.material || null,
    quantity: item.quantity || 1,
    unit_price: item.unit_price || null,
    total_price: item.total_price,
    status: 'selected',
    bid_id: bidId,
    bid_line_item_id: item.id || null,
    vendor_id: bid.vendor_id || null,
    source: 'bid_import',
    notes: item.notes || null,
  }))

  const { data: created, error: insertError } = await supabase
    .from('selections')
    .insert(selectionRows)
    .select('id')

  if (insertError) {
    console.error('Error creating selections from bid:', insertError)
    return { selections_created: 0, error: insertError.message }
  }

  // Link line items back to their selections
  if (created && lineItems.length > 0) {
    for (let i = 0; i < Math.min(created.length, lineItems.length); i++) {
      await supabase
        .from('bid_line_items')
        .update({ selection_id: created[i].id })
        .eq('id', lineItems[i].id)
    }
  }

  // Mark this bid as 'selected'
  await supabase
    .from('bids')
    .update({ status: 'selected', selected_date: new Date().toISOString().split('T')[0] })
    .eq('id', bidId)

  // Reject competing bids in the same category
  await supabase
    .from('bids')
    .update({ status: 'rejected' })
    .eq('project_id', projectId)
    .eq('category', bid.category)
    .neq('id', bidId)
    .in('status', ['pending', 'under_review'])

  return { selections_created: created?.length || 0 }
}

/**
 * Swap vendor: undo the current selection and apply a new one.
 */
export async function swapVendor(
  projectId: string,
  category: string,
  newBidId: string
): Promise<{ selections_created: number; error?: string }> {
  // Find the currently selected bid in this category
  const { data: currentBid } = await supabase
    .from('bids')
    .select('id')
    .eq('project_id', projectId)
    .eq('category', category)
    .eq('status', 'selected')
    .single()

  if (currentBid) {
    // Un-select the current bid
    await supabase
      .from('bids')
      .update({ status: 'under_review' })
      .eq('id', currentBid.id)
  }

  // Un-reject the new bid
  await supabase
    .from('bids')
    .update({ status: 'under_review' })
    .eq('id', newBidId)

  // Now run the normal selection flow
  return selectVendorForCategory(projectId, newBidId)
}

/**
 * Get vendor comparison data for a specific category.
 */
export async function getVendorComparisonForCategory(
  projectId: string,
  category: string
): Promise<{
  category: string
  vendors: Array<{
    bid_id: string
    vendor_name: string
    total_amount: number
    status: string
    line_item_count: number
    line_items: BidLineItem[]
    lead_time_weeks?: number
    pros?: string
    cons?: string
  }>
}> {
  const { data: bids } = await supabase
    .from('bids')
    .select('id, vendor_name, total_amount, status, lead_time_weeks, pros, cons')
    .eq('project_id', projectId)
    .eq('category', category)
    .order('total_amount')

  if (!bids || bids.length === 0) {
    return { category, vendors: [] }
  }

  const vendors = await Promise.all(
    bids.map(async (bid) => {
      const lineItems = await getBidLineItems(bid.id)
      return {
        bid_id: bid.id,
        vendor_name: bid.vendor_name,
        total_amount: bid.total_amount,
        status: bid.status,
        line_item_count: lineItems.length,
        line_items: lineItems,
        lead_time_weeks: bid.lead_time_weeks,
        pros: bid.pros,
        cons: bid.cons,
      }
    })
  )

  return { category, vendors }
}

/**
 * Map bid categories (free-form text) to selection categories (enum).
 * Bid categories come from vendor quotes and are inconsistent.
 */
function mapBidCategoryToSelectionCategory(bidCategory: string): string {
  const lower = bidCategory.toLowerCase()

  const mapping: Record<string, string> = {
    'appliances': 'appliance',
    'countertops': 'countertop',
    'flooring': 'flooring',
    'windows & doors': 'windows',
    'windows and doors': 'windows',
    'garage doors': 'hardware',
    'plumbing fixtures': 'plumbing',
    'exterior lighting': 'lighting',
    'cabinetry': 'cabinetry',
    'cabinets': 'cabinetry',
    'tile': 'tile',
    'paint': 'paint',
    'hardware': 'hardware',
    'civil engineering': 'engineering',
    'foundation engineering': 'engineering',
    'well & septic': 'plumbing',
    'site work': 'site_work',
  }

  // Exact match first
  if (mapping[lower]) return mapping[lower]

  // Partial match
  for (const [key, val] of Object.entries(mapping)) {
    if (lower.includes(key) || key.includes(lower)) return val
  }

  return lower.replace(/\s+/g, '_')
}
