/**
 * PATCH /api/tasks/:taskId/complete
 * Body: { note?: string }
 * Sets task status to 'completed', completed_date to now, appends note if provided.
 * Then triggers a project status regeneration so the dashboard updates immediately.
 */

import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { getProject, getFullProjectContext } from '@/lib/project-service'
import { generateProjectStatusFromData } from '@/lib/project-status-generator'
import { db } from '@/lib/database'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const body = await request.json().catch(() => ({}))
    const { note } = body as { note?: string }

    // Fetch the existing task
    const { data: existing, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (fetchError || !existing) {
      return errorResponse(new Error('Task not found'), 'Task not found')
    }

    // Build updated notes field
    let updatedNotes = existing.notes || ''
    if (note) {
      updatedNotes = updatedNotes
        ? `${updatedNotes}\n[completed: ${note}]`
        : `[completed: ${note}]`
    }

    // Update the task
    const { data: updated, error: updateError } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_date: new Date().toISOString(),
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single()

    if (updateError) {
      return errorResponse(updateError, 'Failed to complete task')
    }

    // Regenerate project status so the dashboard reflects the change immediately
    try {
      const project = await getProject()
      if (project) {
        const ctx = await getFullProjectContext(project.id)
        if (ctx) {
          const snapshot = generateProjectStatusFromData(ctx)
          await db.upsertProjectStatus(project.id, {
            phase: ctx.project.phase,
            current_step: ctx.project.currentStep,
            progress_percentage: Math.round((ctx.project.currentStep / ctx.project.totalSteps) * 100),
            hot_topics: snapshot.hot_topics,
            action_items: snapshot.action_items,
            recent_decisions: snapshot.recent_decisions,
            next_steps: snapshot.next_steps,
            open_questions: snapshot.open_questions,
            key_data_points: snapshot.key_data_points,
            budget_status: ctx.budget.spent <= ctx.budget.total ? 'On Track' : 'Over Budget',
            budget_used: ctx.budget.spent,
            ai_summary: snapshot.ai_summary,
          })
        }
      }
    } catch (statusError) {
      // Non-fatal — task was still completed successfully
      console.error('Failed to regenerate project status (non-fatal):', statusError)
    }

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error, 'Failed to complete task')
  }
}
