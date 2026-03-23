import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getAuthContext, getVendorScope } from '@/lib/authorization'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const project_id = searchParams.get('project_id')
    const category = searchParams.get('category')
    const status = searchParams.get('status')

    let query = supabase
      .from('bids')
      .select('*, vendor:vendors(company_name, category)')
      .order('received_date', { ascending: false })

    if (project_id) {
      query = query.eq('project_id', project_id)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (status) {
      query = query.eq('status', status)
    }

    // Vendor scoping: vendors only see their own bids
    const auth = await getAuthContext()
    const vendorScope = auth ? getVendorScope(auth) : null
    if (vendorScope) {
      query = query.eq('vendor_id', vendorScope)
    }

    const { data, error } = await query

    if (error) throw error

    return successResponse({ bids: data || [] })

  } catch (error) {
    return errorResponse(error, 'Failed to fetch bids')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Verify auth — middleware blocks vendor writes, but defense-in-depth
    const auth = await getAuthContext()
    if (!auth) {
      return errorResponse(new Error('Authentication required'), 'Authentication required')
    }

    const body = await request.json()
    const { bid_id, action, ...updates } = body

    if (!bid_id) {
      return validationError('bid_id is required')
    }

    const updateData: Record<string, unknown> = { ...updates }

    switch (action) {
      case 'select':
        updateData.status = 'selected'
        updateData.selected_date = new Date().toISOString().split('T')[0]
        updateData.needs_review = false
        break

      case 'reject':
        updateData.status = 'rejected'
        updateData.needs_review = false
        break

      case 'under_review':
        updateData.status = 'under_review'
        break

      case 'update':
        break

      default:
        if (action) {
          return validationError('Invalid action')
        }
    }

    const { data, error } = await supabase
      .from('bids')
      .update(updateData)
      .eq('id', bid_id)
      .select()

    if (error) throw error

    // If selecting a bid, auto-reject competing bids in same category
    if (action === 'select' && data && data.length > 0) {
      const selectedBid = data[0]

      await supabase
        .from('bids')
        .update({
          status: 'rejected',
          selection_notes: 'Alternative bid selected'
        })
        .eq('project_id', selectedBid.project_id)
        .eq('category', selectedBid.category)
        .neq('id', bid_id)
        .in('status', ['pending', 'under_review'])
    }

    return successResponse({
      message: `Bid ${action || 'updated'} successfully`,
      bid: data && data.length > 0 ? data[0] : null
    })

  } catch (error) {
    return errorResponse(error, 'Failed to update bid')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify auth — middleware blocks vendor writes, but defense-in-depth
    const auth = await getAuthContext()
    if (!auth) {
      return errorResponse(new Error('Authentication required'), 'Authentication required')
    }

    const body = await request.json()
    const { bid_id, action } = body

    if (!bid_id || action !== 'finalize') {
      return validationError('bid_id and action: "finalize" required')
    }

    // Get bid details
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select('*')
      .eq('id', bid_id)
      .single()

    if (bidError || !bid) {
      return validationError('Bid not found')
    }

    if (bid.status !== 'selected') {
      return validationError('Only selected bids can be finalized')
    }

    // Create budget_item
    const { data: budgetItem, error: budgetError } = await supabase
      .from('budget_items')
      .insert([{
        project_id: bid.project_id,
        category: bid.category,
        subcategory: bid.subcategory,
        description: `${bid.description} - ${bid.vendor_name}`,
        estimated_cost: bid.total_amount,
        vendor_id: bid.vendor_id,
        status: 'approved',
        approval_date: new Date().toISOString().split('T')[0],
        notes: `Finalized from bid #${bid.id}. ${bid.selection_notes || ''}\n\nScope: ${bid.scope_of_work || 'See bid details'}`
      }])
      .select()

    if (budgetError) throw budgetError

    // Update bid to mark as finalized
    await supabase
      .from('bids')
      .update({
        internal_notes: `${bid.internal_notes || ''}\n[Finalized to budget_item: ${budgetItem[0].id} on ${new Date().toISOString().split('T')[0]}]`
      })
      .eq('id', bid_id)

    return successResponse({
      message: 'Bid finalized to budget',
      budget_item: budgetItem[0],
      bid
    })

  } catch (error) {
    return errorResponse(error, 'Failed to finalize bid')
  }
}
