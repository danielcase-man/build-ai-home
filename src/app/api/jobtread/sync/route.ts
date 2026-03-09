import { successResponse, errorResponse } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import { JobTreadSyncService } from '@/lib/jobtread-sync'
import { env } from '@/lib/env'

export async function POST() {
  try {
    if (!env.jobtreadApiKey) {
      return successResponse({ message: 'JobTread not configured', synced: 0 })
    }

    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    console.log('Starting manual JobTread sync...')
    const syncService = new JobTreadSyncService(project.id)
    const result = await syncService.syncAll()

    return successResponse({
      message: `JobTread sync completed: ${result.totalCreated} created, ${result.totalUpdated} updated`,
      ...result,
    })
  } catch (error) {
    return errorResponse(error, 'JobTread sync failed')
  }
}
