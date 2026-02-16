import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { compareBids } from '@/lib/bid-extractor'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bid_ids, project_context } = body

    if (!bid_ids || !Array.isArray(bid_ids) || bid_ids.length < 2) {
      return validationError('At least 2 bid_ids required for comparison')
    }

    // Fetch bids from database
    const { data: bids, error } = await supabase
      .from('bids')
      .select('*')
      .in('id', bid_ids)

    if (error) throw error

    if (!bids || bids.length < 2) {
      return validationError('Could not find enough bids to compare')
    }

    // Convert to format expected by compareBids
    const bidsForComparison = bids.map(bid => ({
      vendor_name: bid.vendor_name,
      vendor_contact: bid.vendor_contact,
      vendor_email: bid.vendor_email,
      vendor_phone: bid.vendor_phone,
      category: bid.category,
      subcategory: bid.subcategory,
      description: bid.description,
      total_amount: parseFloat(bid.total_amount),
      line_items: bid.line_items,
      scope_of_work: bid.scope_of_work,
      inclusions: bid.inclusions,
      exclusions: bid.exclusions,
      payment_terms: bid.payment_terms,
      warranty_terms: bid.warranty_terms,
      estimated_duration: bid.estimated_duration,
      lead_time_weeks: bid.lead_time_weeks,
      valid_until: bid.valid_until,
      ai_confidence: parseFloat(bid.ai_confidence || 0),
      ai_extraction_notes: bid.ai_extraction_notes || ''
    }))

    // Get AI comparison
    const comparison = await compareBids(bidsForComparison, project_context)

    // Store comparison in database
    const { data: comparisonRecord, error: compError } = await supabase
      .from('bid_comparisons')
      .insert([{
        project_id: bids[0].project_id,
        category: bids[0].category,
        description: `Comparison of ${bids.length} bids for ${bids[0].category}`,
        bid_ids: bid_ids,
        evaluation_criteria: comparison
      }])
      .select()

    if (compError) {
      console.error('Error storing comparison:', compError)
    }

    return successResponse({
      bids: bids.map((bid, index) => ({
        id: bid.id,
        vendor_name: bid.vendor_name,
        total_amount: bid.total_amount,
        ...comparison.pros_cons[index]
      })),
      comparison: comparison.comparison,
      recommendation: comparison.recommendation,
      comparison_id: comparisonRecord && comparisonRecord.length > 0 ? comparisonRecord[0].id : null
    })

  } catch (error) {
    return errorResponse(error, 'Failed to compare bids')
  }
}
