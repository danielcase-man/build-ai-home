import { NextRequest } from 'next/server'
import { getEntityHistory } from '@/lib/audit-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const entityType = request.nextUrl.searchParams.get('entityType')
    const entityId = request.nextUrl.searchParams.get('entityId')

    if (!entityType || !entityId) {
      return successResponse({ entries: [] })
    }

    const entries = await getEntityHistory(entityType, entityId)

    return successResponse({ entries })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch audit history')
  }
}
