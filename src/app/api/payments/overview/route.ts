import { getFinancialOverview, getVendorBalances } from '@/lib/financial-service'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project?.id) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const [overview, vendorBalances] = await Promise.all([
      getFinancialOverview(project.id),
      getVendorBalances(project.id),
    ])

    return successResponse({
      ...overview,
      vendorBalances,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch financial overview')
  }
}
