import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { AuthenticationError } from '@/lib/errors'
import { env } from '@/lib/env'
import { getProject, updateProjectStatus } from '@/lib/project-service'
import { JobTreadSyncService } from '@/lib/jobtread-sync'

export async function POST(request: NextRequest) {
  try {
    // Auth check (same pattern as sync-emails cron)
    const authHeader = request.headers.get('authorization')
    const cronSecret = env.cronSecret
    if (!cronSecret) {
      return errorResponse(new AuthenticationError('Cron endpoint not configured'), 'Unauthorized')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse(new AuthenticationError(), 'Unauthorized')
    }

    // Check JobTread is configured
    if (!env.jobtreadApiKey) {
      return successResponse({ message: 'JobTread not configured', synced: 0 })
    }

    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    console.log('Starting automated JobTread sync...')
    const syncService = new JobTreadSyncService(project.id)
    const result = await syncService.syncAll()

    // Refresh AI status after sync (so budget data is included in next report)
    try {
      await updateProjectStatus(project.id)
    } catch (e) {
      console.error('Failed to update project status after JT sync (non-fatal):', e)
    }

    return successResponse({
      message: 'JobTread cron sync completed',
      ...result,
    })
  } catch (error) {
    return errorResponse(error, 'JobTread cron sync failed')
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
