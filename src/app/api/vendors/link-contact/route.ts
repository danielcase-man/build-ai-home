import { NextRequest } from 'next/server'
import { linkVendorToContact, unlinkVendorContact } from '@/lib/vendor-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendorId, contactId } = body

    if (!vendorId) {
      return errorResponse(new Error('vendorId required'), 'vendorId is required')
    }

    if (contactId === null) {
      const success = await unlinkVendorContact(vendorId)
      if (!success) {
        return errorResponse(new Error('Failed to unlink'), 'Failed to unlink vendor contact')
      }
      return successResponse({ message: 'Vendor contact unlinked' })
    }

    if (!contactId) {
      return errorResponse(new Error('contactId required'), 'contactId is required')
    }

    const success = await linkVendorToContact(vendorId, contactId)
    if (!success) {
      return errorResponse(new Error('Failed to link'), 'Failed to link vendor to contact')
    }

    return successResponse({ message: 'Vendor linked to contact' })
  } catch (error) {
    return errorResponse(error, 'Failed to update vendor-contact link')
  }
}
