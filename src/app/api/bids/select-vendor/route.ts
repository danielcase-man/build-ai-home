import { NextRequest } from 'next/server'
import { selectVendorForCategory } from '@/lib/vendor-selection-service'
import { getProject } from '@/lib/project-service'
import { logVendorSelection } from '@/lib/decision-log-service'
import { postPipelineRefresh } from '@/lib/post-pipeline-refresh'
import { supabase } from '@/lib/supabase'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

/**
 * POST /api/bids/select-vendor
 * Body: { bid_id: string, reasoning?: string }
 * Selects a vendor's bid: creates selections from their line items,
 * rejects competing bids, marks old selections as alternatives.
 * CASCADE: logs decision, closes related tasks, updates vendor thread.
 */
export async function POST(request: NextRequest) {
  try {
    const { bid_id, reasoning } = await request.json()
    if (!bid_id) return validationError('bid_id required')

    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const result = await selectVendorForCategory(project.id, bid_id)

    if (result.error) {
      return errorResponse(new Error(result.error), result.error)
    }

    // ── CASCADE: Log the decision ──
    let decisionLogged = false
    if (result.bid) {
      const decision = await logVendorSelection(
        project.id,
        result.bid,
        reasoning || `Selected via bid comparison`
      )
      decisionLogged = !!decision
    }

    // ── CASCADE: Close related tasks ──
    let tasksClosed = 0
    if (result.bid) {
      const category = result.bid.category.toLowerCase()
      const { data: matchingTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', project.id)
        .in('status', ['pending', 'in_progress'])
        .or(`title.ilike.%select%${category}%,title.ilike.%${category}%vendor%,title.ilike.%${category}%bid%`)

      if (matchingTasks && matchingTasks.length > 0) {
        const today = new Date().toISOString().split('T')[0]
        const { count } = await supabase
          .from('tasks')
          .update({
            status: 'completed',
            completed_date: today,
            notes: `Auto-closed: selected ${result.bid.vendor_name} for ${result.bid.category}`,
          })
          .in('id', matchingTasks.map(t => t.id))
          .eq('project_id', project.id)
        tasksClosed = count || 0
      }
    }

    // ── CASCADE: Update vendor thread if one exists ──
    if (result.bid?.vendor_name) {
      const { data: thread } = await supabase
        .from('vendor_threads')
        .select('id')
        .eq('project_id', project.id)
        .ilike('vendor_name', result.bid.vendor_name)
        .limit(1)
        .single()

      if (thread) {
        const today = new Date().toISOString().split('T')[0]
        await supabase
          .from('vendor_threads')
          .update({
            bid_received_date: today,
            status: 'active',
            last_activity: new Date().toISOString(),
          })
          .eq('id', thread.id)
      }
    }

    // ── CASCADE: Refresh cross-cutting data ──
    await postPipelineRefresh(project.id, 'select-vendor').catch(() => {})

    return successResponse({
      message: `Vendor selected — ${result.selections_created} selections created`,
      selections_created: result.selections_created,
      decision_logged: decisionLogged,
      tasks_closed: tasksClosed,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to select vendor')
  }
}
