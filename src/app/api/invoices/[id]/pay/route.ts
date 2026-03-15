import { NextRequest } from 'next/server'
import { createPayment } from '@/lib/financial-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params
    const body = await request.json()
    const { amount, date, payment_method, reference_number, source, notes, vendor_id, contract_id } = body

    if (!amount || !date) {
      return validationError('amount and date are required')
    }

    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const payment = await createPayment({
      project_id: project.id,
      invoice_id: invoiceId,
      vendor_id,
      contract_id,
      amount,
      date,
      payment_method,
      reference_number,
      source: source || 'manual',
      notes,
    })

    return successResponse({ payment })
  } catch (error) {
    return errorResponse(error, 'Failed to record payment')
  }
}
