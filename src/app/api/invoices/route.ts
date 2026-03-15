import { NextRequest } from 'next/server'
import { getInvoices, upsertInvoice } from '@/lib/financial-service'
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
      contractId: searchParams.get('contractId') || undefined,
      status: searchParams.get('status') || undefined,
    }

    const invoices = await getInvoices(project.id, filters)
    return successResponse({ invoices })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch invoices')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      contract_id, vendor_id, invoice_number, description,
      amount, tax_amount, total_amount, date_issued, date_due,
      status, payment_method, notes,
    } = body

    if (!amount || !date_issued) {
      return validationError('amount and date_issued are required')
    }

    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const invoice = await upsertInvoice({
      project_id: project.id,
      contract_id,
      vendor_id,
      invoice_number,
      description,
      amount,
      tax_amount: tax_amount || 0,
      total_amount: total_amount || amount,
      date_issued,
      date_due,
      status: status || 'received',
      payment_method,
      notes,
    })

    return successResponse({ invoice })
  } catch (error) {
    return errorResponse(error, 'Failed to save invoice')
  }
}
