import { NextRequest } from 'next/server'
import { getPayments, createPayment } from '@/lib/financial-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const { searchParams } = new URL(request.url)
    const filters = {
      vendorId: searchParams.get('vendorId') || undefined,
      invoiceId: searchParams.get('invoiceId') || undefined,
      contractId: searchParams.get('contractId') || undefined,
    }

    const payments = await getPayments(project.id, filters)
    return successResponse({ payments })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch payments')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendor_id, invoice_id, contract_id, transaction_id, amount, date, payment_method, reference_number, source, notes } = body

    if (!amount || !date) {
      return validationError('amount and date are required')
    }

    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const payment = await createPayment({
      project_id: project.id,
      vendor_id,
      invoice_id,
      contract_id,
      transaction_id,
      amount,
      date,
      payment_method,
      reference_number,
      source: source || 'manual',
      notes,
    })

    return successResponse({ payment })
  } catch (error) {
    return errorResponse(error, 'Failed to create payment')
  }
}
