import { successResponse, errorResponse } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import { getBlockers, getReadyItems } from '@/lib/knowledge-graph'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) {
      return successResponse({ blockers: [], ready: [] })
    }

    const [blockers, readyItems] = await Promise.all([
      getBlockers(project.id),
      getReadyItems(project.id),
    ])

    return successResponse({
      blockers: blockers.map(b => ({
        item: {
          id: b.item.id,
          item_name: b.item.item_name,
          trade: b.item.trade,
          phase_number: b.item.phase_number,
        },
        state: b.state,
        unmet_dependencies: b.unmetDependencies.map(d => ({
          id: d.id,
          item_name: d.item_name,
          trade: d.trade,
        })),
      })),
      ready: readyItems.map(r => ({
        id: r.id,
        item_name: r.item_name,
        trade: r.trade,
        phase_number: r.phase_number,
        item_type: r.item_type,
        typical_duration_days: r.typical_duration_days,
      })),
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch blockers')
  }
}
