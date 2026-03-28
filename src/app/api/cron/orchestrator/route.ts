/**
 * Orchestrator Cron Endpoint
 *
 * Runs the daily construction management loop.
 * Scheduled via Vercel Cron at 7:00 AM daily (before email sync at 8 AM).
 *
 * The orchestrator checks follow-ups, bid deadlines, lead times,
 * logs decisions, and generates alerts. It does NOT call the Anthropic API.
 */

import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { AuthenticationError } from '@/lib/errors'
import { env } from '@/lib/env'
import { generateProjectStatusFromData } from '@/lib/project-status-generator'
import { getFullProjectContext } from '@/lib/project-service'

const TODAY = new Date().toISOString().split('T')[0]

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!env.cronSecret || authHeader !== `Bearer ${env.cronSecret}`) {
      return errorResponse(new AuthenticationError(), 'Unauthorized')
    }

    const project = await getProject()
    if (!project) return successResponse({ message: 'No project', ran: false })

    console.log(`Orchestrator starting for ${project.id}...`)

    // Create run record
    const { data: run } = await supabase
      .from('orchestrator_runs')
      .insert({ project_id: project.id, run_date: TODAY, status: 'running' })
      .select('id')
      .single()

    const runId = run?.id
    const actions: Array<{ type: string; vendor?: string; detail: string; timestamp: string }> = []
    const alerts: Array<{ priority: string; message: string }> = []
    const errors: Array<{ message: string }> = []

    // Step 1: Check overdue vendor follow-ups
    try {
      const { data: overdue } = await supabase
        .from('vendor_follow_ups')
        .select('*')
        .eq('project_id', project.id)
        .lte('next_follow_up_date', TODAY)
        .in('status', ['sent', 'awaiting_response', 'follow_up_sent'])

      if (overdue && overdue.length > 0) {
        for (const fu of overdue) {
          if (fu.follow_up_count >= fu.max_follow_ups) {
            await supabase.from('vendor_follow_ups').update({
              status: 'escalated', escalation_date: TODAY,
            }).eq('id', fu.id)

            alerts.push({ priority: 'high', message: `${fu.vendor_name} ESCALATED: no response after ${fu.follow_up_count} follow-ups for "${fu.subject}"` })
            actions.push({ type: 'escalated', vendor: fu.vendor_name, detail: `Escalated "${fu.subject}"`, timestamp: new Date().toISOString() })
          } else {
            const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + 3)
            await supabase.from('vendor_follow_ups').update({
              status: 'follow_up_sent',
              follow_up_count: fu.follow_up_count + 1,
              next_follow_up_date: nextDate.toISOString().split('T')[0],
              last_contact_date: TODAY,
            }).eq('id', fu.id)

            alerts.push({ priority: 'medium', message: `${fu.vendor_name} — follow-up #${fu.follow_up_count + 1} needed for "${fu.subject}"` })
            actions.push({ type: 'follow_up_queued', vendor: fu.vendor_name, detail: `Follow-up #${fu.follow_up_count + 1} queued`, timestamp: new Date().toISOString() })
          }
        }
      }
    } catch (e) { errors.push({ message: `Follow-up check failed: ${e}` }) }

    // Step 2: Check bid deadlines
    try {
      const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      const { data: expiringBids } = await supabase
        .from('bids')
        .select('vendor_name, category, valid_until')
        .eq('project_id', project.id)
        .eq('status', 'pending')
        .not('valid_until', 'is', null)
        .lte('valid_until', sevenDaysOut)

      if (expiringBids) {
        for (const bid of expiringBids) {
          const expired = bid.valid_until < TODAY
          alerts.push({
            priority: expired ? 'high' : 'medium',
            message: `${bid.vendor_name} ${bid.category} bid ${expired ? 'EXPIRED' : 'expiring'} ${bid.valid_until}`
          })
        }
      }
    } catch (e) { errors.push({ message: `Bid deadline check failed: ${e}` }) }

    // Step 3: Check lead times
    try {
      const { data: selections } = await supabase
        .from('selections')
        .select('product_name, category, lead_time_days, needed_by_date, status')
        .eq('project_id', project.id)
        .in('status', ['considering', 'selected'])
        .not('lead_time_days', 'is', null)
        .not('needed_by_date', 'is', null)

      if (selections) {
        for (const sel of selections) {
          if (!sel.lead_time_days || !sel.needed_by_date) continue
          const orderBy = new Date(new Date(sel.needed_by_date).getTime() - sel.lead_time_days * 86400000)
          const daysUntilOrder = Math.floor((orderBy.getTime() - Date.now()) / 86400000)

          if (daysUntilOrder < 0) {
            alerts.push({ priority: 'high', message: `LATE: ${sel.product_name} should have been ordered ${Math.abs(daysUntilOrder)} days ago` })
          } else if (daysUntilOrder <= 7) {
            alerts.push({ priority: 'high', message: `ORDER NOW: ${sel.product_name} — order within ${daysUntilOrder} days` })
          }
        }
      }
    } catch (e) { errors.push({ message: `Lead time check failed: ${e}` }) }

    // Step 4: Update project status (deterministic)
    try {
      const fullContext = await getFullProjectContext(project.id)
      if (fullContext) {
        const snapshot = generateProjectStatusFromData(fullContext)
        const { db } = await import('@/lib/database')
        await db.upsertProjectStatus(project.id, {
          phase: fullContext.project.phase,
          current_step: fullContext.project.currentStep,
          progress_percentage: Math.round((fullContext.project.currentStep / fullContext.project.totalSteps) * 100),
          hot_topics: snapshot.hot_topics,
          action_items: snapshot.action_items,
          recent_decisions: snapshot.recent_decisions,
          next_steps: snapshot.next_steps,
          open_questions: snapshot.open_questions,
          key_data_points: snapshot.key_data_points,
          budget_status: fullContext.budget.spent <= fullContext.budget.total ? 'On Track' : 'Over Budget',
          budget_used: fullContext.budget.spent,
          ai_summary: snapshot.ai_summary,
        })
        actions.push({ type: 'status_updated', detail: 'Project status snapshot regenerated', timestamp: new Date().toISOString() })
      }
    } catch (e) { errors.push({ message: `Status update failed: ${e}` }) }

    // Complete the run
    if (runId) {
      await supabase.from('orchestrator_runs').update({
        completed_at: new Date().toISOString(),
        status: errors.length > 0 ? 'partial' : 'completed',
        actions_taken: actions,
        alerts_generated: alerts,
        follow_ups_sent: actions.filter(a => a.type === 'follow_up_queued').length,
        statuses_updated: 1,
        errors,
      }).eq('id', runId)
    }

    const highAlerts = alerts.filter(a => a.priority === 'high').length

    console.log(`Orchestrator complete: ${actions.length} actions, ${alerts.length} alerts (${highAlerts} high), ${errors.length} errors`)

    return successResponse({
      ran: true,
      runId,
      actions: actions.length,
      alerts: alerts.length,
      highAlerts,
      errors: errors.length,
    })
  } catch (error) {
    return errorResponse(error, 'Orchestrator failed')
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
