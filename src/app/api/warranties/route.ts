import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import { getWarranties, getExpiringWarranties, createWarranty, getCompliance, getComplianceGaps, createCompliance, verifyCompliance } from '@/lib/warranty-service'
import type { WarrantyStatus } from '@/lib/warranty-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return successResponse({ warranties: [] })

    const { searchParams } = request.nextUrl
    const view = searchParams.get('view')

    if (view === 'expiring') {
      const expiring = await getExpiringWarranties(project.id)
      return successResponse({ count: expiring.length, warranties: expiring })
    }

    if (view === 'compliance') {
      const compliance = await getCompliance(project.id)
      return successResponse({ count: compliance.length, compliance })
    }

    if (view === 'compliance_gaps') {
      const gaps = await getComplianceGaps(project.id)
      return successResponse(gaps)
    }

    const status = (searchParams.get('status') || undefined) as WarrantyStatus | undefined
    const warranties = await getWarranties(project.id, { status })
    return successResponse({ count: warranties.length, warranties })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch warranties')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()

    if (body.type === 'compliance') {
      if (!body.insurance_type || !body.effective_date || !body.expiration_date) {
        return validationError('Missing required fields for compliance')
      }
      const record = await createCompliance({
        project_id: project.id,
        vendor_id: body.vendor_id || null,
        vendor_name: body.vendor_name || null,
        insurance_type: body.insurance_type,
        policy_number: body.policy_number || null,
        carrier: body.carrier || null,
        coverage_amount: body.coverage_amount || null,
        effective_date: body.effective_date,
        expiration_date: body.expiration_date,
        verified: body.verified || false,
      })
      return successResponse({ compliance: record })
    }

    // Default: create warranty
    if (!body.category || !body.warranty_type || !body.start_date || !body.end_date) {
      return validationError('Missing required fields: category, warranty_type, start_date, end_date')
    }

    const warranty = await createWarranty({
      project_id: project.id,
      vendor_id: body.vendor_id || null,
      vendor_name: body.vendor_name || null,
      category: body.category,
      item_description: body.item_description || body.category,
      warranty_type: body.warranty_type,
      start_date: body.start_date,
      end_date: body.end_date,
      duration_months: body.duration_months || null,
      coverage_details: body.coverage_details || null,
      status: 'active',
    })

    return successResponse({ warranty })
  } catch (error) {
    return errorResponse(error, 'Failed to create record')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.action === 'verify_compliance' && body.id) {
      const success = await verifyCompliance(body.id)
      return successResponse({ success })
    }

    return validationError('Invalid action')
  } catch (error) {
    return errorResponse(error, 'Failed to update record')
  }
}
