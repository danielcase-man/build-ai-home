import { updateSelection } from '@/lib/selections-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return validationError('Selection id is required')
    }

    const updated = await updateSelection(id, updates)
    if (!updated) {
      return errorResponse(new Error('Selection not found'), 'Failed to update selection')
    }

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error, 'Failed to update selection')
  }
}
