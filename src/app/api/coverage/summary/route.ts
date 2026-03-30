import { NextRequest } from 'next/server'
import { getProjectCoverageSummary } from '@/lib/coverage-scoring-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/coverage/summary?projectId=xxx
 * Returns per-category coverage summaries with bid scores and takeoff item data.
 * If no projectId provided, uses the first project (single-user pattern).
 */
export async function GET(request: NextRequest) {
  try {
    let projectId = request.nextUrl.searchParams.get('projectId')

    if (!projectId) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)

      if (!projects || projects.length === 0) {
        return validationError('No project found')
      }
      projectId = projects[0].id as string
    }

    const summaries = await getProjectCoverageSummary(projectId)
    return successResponse({ summaries, projectId })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch coverage summary')
  }
}
