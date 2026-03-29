/**
 * GET /api/intelligence/status
 *
 * Returns the latest intelligence run result and file inventory stats.
 * Used by the dashboard to show "Last updated" and processing status.
 */

import { NextRequest } from 'next/server'
import { getLatestRun } from '@/lib/intelligence-engine'
import { getAllWatermarks } from '@/lib/source-watermarks'
import { getInventoryStats } from '@/lib/dropbox-watcher'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET(_request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) {
      return successResponse({ message: 'No project found' })
    }

    const [latestRun, watermarks, inventoryStats] = await Promise.all([
      getLatestRun(),
      getAllWatermarks(),
      getInventoryStats(project.id),
    ])

    return successResponse({
      latest_run: latestRun,
      watermarks,
      inventory: inventoryStats,
      project_id: project.id,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to get intelligence status')
  }
}
