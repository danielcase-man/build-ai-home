import { executeAction } from '@/lib/assistant-actions'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import type { PendingAction } from '@/types'

export async function POST(request: Request) {
  try {
    const { action } = await request.json() as { action: PendingAction }

    if (!action?.type || !action?.data) {
      return validationError('action with type and data is required')
    }

    const result = await executeAction(action)

    if (!result.success) {
      return errorResponse(new Error(result.message), result.message)
    }

    return successResponse({
      message: result.message,
      data: result.data,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to apply action')
  }
}
