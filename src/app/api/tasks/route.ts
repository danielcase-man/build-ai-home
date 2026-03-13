import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) return successResponse({ tasks: [] })

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })

    if (error) return errorResponse(error, 'Failed to fetch tasks')
    return successResponse({ tasks: data || [] })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch tasks')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return validationError('No project found')

    const body = await request.json()
    const { task_id, status, notes, resolution_note } = body

    if (!task_id) return validationError('Missing task_id')

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (status) updates.status = status
    if (notes !== undefined) updates.notes = notes

    // Append a resolution note to existing notes
    if (resolution_note) {
      const { data: existing } = await supabase
        .from('tasks')
        .select('notes')
        .eq('id', task_id)
        .single()

      const timestamp = new Date().toISOString().split('T')[0]
      const suffix = `[${timestamp}] ${resolution_note}`
      updates.notes = existing?.notes
        ? `${existing.notes}\n${suffix}`
        : suffix
    }

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', task_id)
      .eq('project_id', project.id)
      .select()
      .single()

    if (error) return errorResponse(error, 'Failed to update task')
    return successResponse({ task: data })
  } catch (error) {
    return errorResponse(error, 'Failed to update task')
  }
}
