import { NextRequest } from 'next/server'
import { getTransactions } from '@/lib/financial-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const { searchParams } = new URL(request.url)
    const filters = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      vendorId: searchParams.get('vendorId') || undefined,
      matchStatus: (searchParams.get('matchStatus') || undefined) as 'unmatched' | 'auto_matched' | 'confirmed' | 'excluded' | 'manual' | undefined,
      isConstructionRelated: searchParams.has('constructionOnly') ? true : undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    }

    const result = await getTransactions(project.id, filters)
    return successResponse(result)
  } catch (error) {
    return errorResponse(error, 'Failed to fetch transactions')
  }
}
