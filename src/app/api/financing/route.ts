import { getProject } from '@/lib/project-service'
import { getConstructionLoan, upsertConstructionLoan } from '@/lib/loan-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) {
      return successResponse({ loan: null })
    }

    const loan = await getConstructionLoan(project.id)
    return successResponse({ loan })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch financing data')
  }
}

export async function POST(request: Request) {
  try {
    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const body = await request.json()
    const loan = await upsertConstructionLoan(project.id, body)

    if (!loan) {
      return errorResponse(new Error('Failed to save loan'), 'Failed to save loan data')
    }

    return successResponse({ loan })
  } catch (error) {
    return errorResponse(error, 'Failed to save financing data')
  }
}
