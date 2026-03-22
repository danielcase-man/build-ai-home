import { getProject } from '@/lib/project-service'
import { getActiveConstructionLoan, getConstructionLoanHistory, upsertConstructionLoan } from '@/lib/loan-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) {
      return successResponse({ loan: null, history: [] })
    }

    const [loan, history] = await Promise.all([
      getActiveConstructionLoan(project.id),
      getConstructionLoanHistory(project.id),
    ])

    return successResponse({ loan, history })
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
    const result = await upsertConstructionLoan(project.id, body)

    if (!result.loan) {
      return errorResponse(new Error('Failed to save loan'), 'Failed to save loan data')
    }

    return successResponse({ loan: result.loan, history: result.history })
  } catch (error) {
    return errorResponse(error, 'Failed to save financing data')
  }
}
