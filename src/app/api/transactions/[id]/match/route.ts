import { NextRequest } from 'next/server'
import { updateTransactionMatch, createPayment } from '@/lib/financial-service'
import { learnFromConfirmedMatch } from '@/lib/transaction-matcher'
import { getProject } from '@/lib/project-service'
import { supabase } from '@/lib/supabase'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params
    const body = await request.json()
    const { vendor_id, budget_item_id, invoice_id, is_construction_related, category_override } = body

    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    // Determine match status
    const matchStatus = is_construction_related === false ? 'excluded'
      : (vendor_id || invoice_id) ? 'confirmed'
      : 'manual'

    const success = await updateTransactionMatch(transactionId, {
      vendor_id: vendor_id || null,
      budget_item_id: budget_item_id || null,
      invoice_id: invoice_id || null,
      match_status: matchStatus,
      match_confidence: 1.0,
      is_construction_related: is_construction_related !== false,
      category_override,
    })

    if (!success) {
      return validationError('Failed to update transaction match')
    }

    // Learn from confirmed matches for future auto-matching
    if (vendor_id && matchStatus === 'confirmed') {
      const { data: txn } = await supabase
        .from('transactions')
        .select('merchant_name')
        .eq('id', transactionId)
        .single()

      if (txn?.merchant_name) {
        await learnFromConfirmedMatch(txn.merchant_name, vendor_id, project.id)
      }
    }

    // Auto-create payment record if matched to an invoice
    if (invoice_id) {
      const { data: txn } = await supabase
        .from('transactions')
        .select('amount, date')
        .eq('id', transactionId)
        .single()

      if (txn) {
        await createPayment({
          project_id: project.id,
          transaction_id: transactionId,
          invoice_id,
          vendor_id: vendor_id || undefined,
          amount: txn.amount,
          date: txn.date,
          source: 'plaid',
        })
      }
    }

    return successResponse({ matched: true })
  } catch (error) {
    return errorResponse(error, 'Failed to match transaction')
  }
}
