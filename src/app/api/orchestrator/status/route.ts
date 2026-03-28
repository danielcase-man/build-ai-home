/**
 * Orchestrator Status API — shows recent runs, alerts, and follow-up stats.
 * Used by the dashboard to display orchestrator health.
 */

import { supabase } from '@/lib/supabase'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) return successResponse({ runs: [], followUps: { total: 0, overdue: 0, escalated: 0 } })

    const today = new Date().toISOString().split('T')[0]

    // Get last 7 orchestrator runs
    const { data: runs } = await supabase
      .from('orchestrator_runs')
      .select('*')
      .eq('project_id', project.id)
      .order('started_at', { ascending: false })
      .limit(7)

    // Get follow-up stats
    const { data: followUps } = await supabase
      .from('vendor_follow_ups')
      .select('status')
      .eq('project_id', project.id)
      .not('status', 'in', '("completed","cancelled")')

    const stats = {
      total: followUps?.length || 0,
      overdue: 0,
      escalated: 0,
      awaiting: 0,
    }

    if (followUps) {
      for (const fu of followUps) {
        if (fu.status === 'escalated') stats.escalated++
        else if (fu.status === 'awaiting_response' || fu.status === 'follow_up_sent') stats.awaiting++
      }
    }

    // Count overdue separately (need the date check)
    const { count: overdueCount } = await supabase
      .from('vendor_follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .lte('next_follow_up_date', today)
      .in('status', ['sent', 'awaiting_response', 'follow_up_sent'])

    stats.overdue = overdueCount || 0

    // Get latest run's alerts (for dashboard banner)
    const latestRun = runs && runs.length > 0 ? runs[0] : null
    const highAlerts = latestRun?.alerts_generated?.filter(
      (a: { priority: string }) => a.priority === 'high'
    ) || []

    return successResponse({
      runs: runs || [],
      followUps: stats,
      latestAlerts: highAlerts,
      lastRunDate: latestRun?.run_date || null,
      lastRunStatus: latestRun?.status || null,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to get orchestrator status')
  }
}
