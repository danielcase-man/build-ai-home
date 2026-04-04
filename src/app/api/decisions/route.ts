import { NextResponse } from 'next/server'
import { getProject } from '@/lib/project-service'
import { logDecision, getDecisions } from '@/lib/decision-log-service'
import { postPipelineRefresh } from '@/lib/post-pipeline-refresh'
import { supabase } from '@/lib/supabase'
import type { DecisionType, OutcomeStatus } from '@/types'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) return NextResponse.json({ error: 'No project' }, { status: 404 })

    const decisions = await getDecisions(project.id)
    return NextResponse.json({ data: decisions })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const project = await getProject()
    if (!project) return NextResponse.json({ error: 'No project' }, { status: 404 })

    const body = await request.json()
    const {
      decision_type,
      category,
      title,
      description,
      chosen_option,
      alternatives,
      reasoning,
      cost_impact,
      schedule_impact_days,
      decided_by = 'Daniel Case',
      related_bid_id,
      related_vendor_id,
      close_task_ids,
    } = body as {
      decision_type: DecisionType
      category?: string
      title: string
      description?: string
      chosen_option: string
      alternatives?: Array<{ name: string; amount?: number; reason_rejected?: string }>
      reasoning?: string
      cost_impact?: number
      schedule_impact_days?: number
      decided_by?: string
      related_bid_id?: string
      related_vendor_id?: string
      close_task_ids?: string[]
    }

    if (!title || !decision_type || !chosen_option) {
      return NextResponse.json({ error: 'Missing required fields: title, decision_type, chosen_option' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)

    // 1. Log the decision
    const decision = await logDecision({
      project_id: project.id,
      decision_type,
      category,
      title,
      description,
      chosen_option,
      alternatives,
      reasoning,
      cost_impact,
      schedule_impact_days,
      decided_by,
      decided_date: today,
      related_bid_id,
      related_vendor_id,
      outcome_status: 'pending' as OutcomeStatus,
    })

    if (!decision) {
      return NextResponse.json({ error: 'Failed to log decision' }, { status: 500 })
    }

    // 2. Cascade: close related tasks
    const closedTasks: string[] = []
    if (close_task_ids && close_task_ids.length > 0) {
      for (const taskId of close_task_ids) {
        const { error } = await supabase
          .from('tasks')
          .update({
            status: 'completed',
            completed_date: today,
            notes: `Closed by decision: ${title}`,
          })
          .eq('id', taskId)
          .eq('project_id', project.id)
        if (!error) closedTasks.push(taskId)
      }
    }

    // 3. Cascade: if vendor_selection, update bid status
    if (decision_type === 'vendor_selection' && related_bid_id) {
      // Mark the selected bid
      await supabase
        .from('bids')
        .update({ status: 'selected', selection_notes: reasoning || `Decision: ${title}` })
        .eq('id', related_bid_id)
        .eq('project_id', project.id)

      // Reject other active bids in the same category
      if (category) {
        await supabase
          .from('bids')
          .update({ status: 'rejected', selection_notes: `Passed — selected different vendor (${chosen_option})` })
          .eq('project_id', project.id)
          .eq('category', category)
          .neq('id', related_bid_id)
          .in('status', ['pending', 'under_review'])
      }
    }

    // 4. Cascade: refresh cross-cutting data
    await postPipelineRefresh(project.id, 'decision').catch(() => {})

    return NextResponse.json({
      data: {
        decision,
        closedTasks,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
