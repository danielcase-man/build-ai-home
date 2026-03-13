/**
 * POST /api/cron/daily-status
 *
 * Daily 5 PM CST cron: syncs emails, then regenerates the project status
 * snapshot so the dashboard reflects the latest activity.
 *
 * Steps:
 * 1. Sync emails from Gmail (same logic as sync-emails cron)
 * 2. Sync latest data from JobTread
 * 3. Regenerate AI project status snapshot (picks up new emails + task updates)
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { updateProjectStatus, getProject } from '@/lib/project-service'
import { AuthenticationError } from '@/lib/errors'
import { env } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const cronSecret = env.cronSecret

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse(new AuthenticationError(), 'Unauthorized')
    }

    console.log('[daily-status] Starting daily status update at', new Date().toISOString())
    const results: string[] = []

    // 1. Trigger email sync (call our own endpoint internally)
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

      const emailRes = await fetch(`${baseUrl}/api/cron/sync-emails`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const emailData = await emailRes.json()
      const synced = emailData?.data?.synced ?? emailData?.synced ?? 0
      results.push(`Email sync: ${synced} new emails`)
      console.log(`[daily-status] Email sync complete: ${synced} new`)
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : 'unknown'
      results.push(`Email sync failed: ${msg}`)
      console.error('[daily-status] Email sync error:', emailErr)
    }

    // 2. Trigger JobTread sync
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

      const jtRes = await fetch(`${baseUrl}/api/cron/sync-jobtread`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const jtData = await jtRes.json()
      const created = jtData?.data?.totalCreated ?? 0
      const updated = jtData?.data?.totalUpdated ?? 0
      results.push(`JobTread sync: ${created} created, ${updated} updated`)
      console.log(`[daily-status] JobTread sync complete: ${created} created, ${updated} updated`)
    } catch (jtErr) {
      const msg = jtErr instanceof Error ? jtErr.message : 'unknown'
      results.push(`JobTread sync failed: ${msg}`)
      console.error('[daily-status] JobTread sync error:', jtErr)
    }

    // 3. Regenerate project status snapshot
    const project = await getProject()
    if (project) {
      try {
        console.log('[daily-status] Generating project status snapshot...')
        await updateProjectStatus(project.id)
        results.push('Status snapshot: updated')
        console.log('[daily-status] Status snapshot generated')
      } catch (statusErr) {
        const msg = statusErr instanceof Error ? statusErr.message : 'unknown'
        results.push(`Status snapshot failed: ${msg}`)
        console.error('[daily-status] Status snapshot error:', statusErr)
      }
    } else {
      results.push('Status snapshot: skipped (no project)')
    }

    console.log('[daily-status] Complete:', results.join('; '))

    return successResponse({
      message: 'Daily status update complete',
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return errorResponse(error, 'Daily status update failed')
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
