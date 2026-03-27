import { supabase } from '@/lib/supabase'
import { successResponse } from '@/lib/api-utils'

/**
 * GET /api/health
 * Returns sync health status for all data sources.
 * Used by the dashboard to show a warning banner when data is stale.
 */
export async function GET() {
  const now = new Date()
  const checks: Array<{
    source: string
    status: 'ok' | 'stale' | 'error'
    lastSync: string | null
    message: string
  }> = []

  // Check Gmail sync (should be within 24h)
  const { data: emailAccount } = await supabase
    .from('email_accounts')
    .select('last_sync, sync_enabled')
    .limit(1)
    .single()

  if (emailAccount?.last_sync) {
    const lastSync = new Date(emailAccount.last_sync)
    const hoursAgo = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)
    checks.push({
      source: 'Gmail',
      status: hoursAgo < 24 ? 'ok' : hoursAgo < 72 ? 'stale' : 'error',
      lastSync: emailAccount.last_sync,
      message: hoursAgo < 24
        ? `Synced ${Math.round(hoursAgo)}h ago`
        : `Last sync ${Math.round(hoursAgo / 24)}d ago — may need re-authorization`,
    })
  } else {
    checks.push({
      source: 'Gmail',
      status: 'error',
      lastSync: null,
      message: 'Gmail not connected',
    })
  }

  // Check AI status report (should be within 24h)
  const { data: latestStatus } = await supabase
    .from('project_status')
    .select('created_at, ai_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestStatus?.created_at) {
    const lastReport = new Date(latestStatus.created_at)
    const hoursAgo = (now.getTime() - lastReport.getTime()) / (1000 * 60 * 60)
    const hasContent = latestStatus.ai_summary && !latestStatus.ai_summary.includes('Unable to generate')
    checks.push({
      source: 'AI Reports',
      status: hoursAgo < 48 && hasContent ? 'ok' : 'stale',
      lastSync: latestStatus.created_at,
      message: hasContent
        ? `Report generated ${Math.round(hoursAgo)}h ago`
        : 'AI report generation failing',
    })
  }

  // Check latest email (are we getting fresh data?)
  const { data: latestEmail } = await supabase
    .from('emails')
    .select('received_date')
    .order('received_date', { ascending: false })
    .limit(1)
    .single()

  if (latestEmail?.received_date) {
    const latestDate = new Date(latestEmail.received_date)
    const daysAgo = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysAgo > 3) {
      checks.push({
        source: 'Email Data',
        status: 'stale',
        lastSync: latestEmail.received_date,
        message: `Newest email is ${Math.round(daysAgo)}d old — sync may be broken`,
      })
    }
  }

  const hasIssues = checks.some(c => c.status !== 'ok')

  return successResponse({
    healthy: !hasIssues,
    checks,
  })
}
