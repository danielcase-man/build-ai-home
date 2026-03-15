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
import { getWorkflowAlerts } from '@/lib/workflow-service'
import { createWorkflowAlertNotification } from '@/lib/notification-service'
import { getFollowUpsNeeded } from '@/lib/vendor-thread-service'
import { getExpiringWarranties, getComplianceGaps } from '@/lib/warranty-service'

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

      // 4. Check workflow alerts
      try {
        console.log('[daily-status] Checking workflow alerts...')
        const alerts = await getWorkflowAlerts(project.id)
        const blockers = alerts.filter(a => a.type === 'blocker')
        const decisions = alerts.filter(a => a.type === 'decision_needed')

        // Create notifications for blockers and urgent decisions
        for (const alert of blockers) {
          await createWorkflowAlertNotification(
            project.id,
            'blocker',
            alert.title.replace('Blocked: ', ''),
            alert.message
          )
        }
        for (const decision of decisions.slice(0, 3)) {
          await createWorkflowAlertNotification(
            project.id,
            'decision_needed',
            decision.title.replace('Decision needed: ', ''),
            decision.message
          )
        }

        results.push(`Workflow: ${blockers.length} blockers, ${decisions.length} decisions pending`)
        console.log(`[daily-status] Workflow alerts: ${blockers.length} blockers, ${decisions.length} decisions`)
      } catch (wfErr) {
        const msg = wfErr instanceof Error ? wfErr.message : 'unknown'
        results.push(`Workflow check failed: ${msg}`)
        console.error('[daily-status] Workflow check error:', wfErr)
      }

      // 5. Check for overdue vendor follow-ups
      try {
        console.log('[daily-status] Checking vendor follow-ups...')
        const followUps = await getFollowUpsNeeded(project.id, 5)
        if (followUps.length > 0) {
          for (const fu of followUps.slice(0, 5)) {
            await createWorkflowAlertNotification(
              project.id,
              'decision_needed',
              fu.thread.vendor_name,
              `${fu.reason} (${fu.thread.category || 'General'})`
            )
          }
        }
        results.push(`Vendor follow-ups: ${followUps.length} needed`)
        console.log(`[daily-status] Vendor follow-ups: ${followUps.length} needed`)
      } catch (fuErr) {
        const msg = fuErr instanceof Error ? fuErr.message : 'unknown'
        results.push(`Vendor follow-up check failed: ${msg}`)
        console.error('[daily-status] Vendor follow-up error:', fuErr)
      }

      // 6. Check expiring warranties and compliance gaps
      try {
        const [expiring, gaps] = await Promise.all([
          getExpiringWarranties(project.id),
          getComplianceGaps(project.id),
        ])
        for (const w of expiring) {
          await createWorkflowAlertNotification(
            project.id,
            'decision_needed',
            w.vendor_name || w.category,
            `Warranty expiring ${w.end_date}: ${w.item_description}`
          )
        }
        for (const c of gaps.expired) {
          await createWorkflowAlertNotification(
            project.id,
            'blocker',
            c.vendor_name || 'Subcontractor',
            `${c.insurance_type} insurance expired ${c.expiration_date}`
          )
        }
        results.push(`Warranties: ${expiring.length} expiring, ${gaps.expired.length} compliance issues`)
      } catch (wErr) {
        const msg = wErr instanceof Error ? wErr.message : 'unknown'
        results.push(`Warranty check failed: ${msg}`)
        console.error('[daily-status] Warranty check error:', wErr)
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
