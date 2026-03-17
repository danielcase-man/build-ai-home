import { createSelection, updateSelection } from '@/lib/selections-service'
import { checkAndCompleteSelectionDecisions } from '@/lib/workflow-service'
import { resolveKnowledgeIdForSelection, getPhaseForSelectionCategory } from '@/lib/category-mapping'
import { parseLeadTimeDays } from '@/lib/lead-time-utils'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.room || !body.category || !body.product_name) {
      return validationError('room, category, and product_name are required')
    }

    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    // Auto-resolve knowledge_id and phase from category mapping
    let knowledgeId = body.knowledge_id || null
    let neededByPhase = body.needed_by_phase || null
    if (!knowledgeId) {
      knowledgeId = await resolveKnowledgeIdForSelection(body.category)
    }
    if (!neededByPhase) {
      neededByPhase = getPhaseForSelectionCategory(body.category)
    }

    // Parse lead_time string into days
    let leadTimeDays = body.lead_time_days || null
    if (!leadTimeDays && body.lead_time) {
      leadTimeDays = parseLeadTimeDays(body.lead_time)
    }

    const selection = await createSelection({
      project_id: project.id,
      room: body.room,
      category: body.category,
      subcategory: body.subcategory || undefined,
      product_name: body.product_name,
      brand: body.brand || undefined,
      model_number: body.model_number || undefined,
      finish: body.finish || undefined,
      color: body.color || undefined,
      quantity: body.quantity || 1,
      unit_price: body.unit_price || undefined,
      total_price: body.total_price || undefined,
      status: body.status || 'considering',
      lead_time: body.lead_time || undefined,
      product_url: body.product_url || undefined,
      notes: body.notes || undefined,
      knowledge_id: knowledgeId,
      needed_by_phase: neededByPhase,
      needed_by_date: body.needed_by_date || undefined,
      lead_time_days: leadTimeDays,
    })

    if (!selection) {
      return errorResponse(new Error('Failed to create selection'), 'Failed to create selection')
    }

    return successResponse(selection, 201)
  } catch (error) {
    return errorResponse(error, 'Failed to create selection')
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return validationError('Selection id is required')
    }

    const updated = await updateSelection(id, updates)
    if (!updated) {
      return errorResponse(new Error('Selection not found'), 'Failed to update selection')
    }

    // When status changes to selected/ordered, check if workflow decision can auto-complete
    if (updates.status && ['selected', 'ordered'].includes(updates.status)) {
      const project = await getProject()
      if (project && updated.category) {
        // Fire-and-forget: don't block the response
        checkAndCompleteSelectionDecisions(project.id, updated.category).catch(() => {})
      }
    }

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error, 'Failed to update selection')
  }
}
