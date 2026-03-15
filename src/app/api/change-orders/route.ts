import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import { getChangeOrders, getChangeOrderSummary, createChangeOrder, updateChangeOrder } from '@/lib/change-order-service'
import type { ChangeOrderReason, ChangeOrderStatus } from '@/lib/change-order-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return successResponse({ change_orders: [] })

    const { searchParams } = request.nextUrl
    if (searchParams.get('view') === 'summary') {
      const summary = await getChangeOrderSummary(project.id)
      return successResponse(summary)
    }

    const status = (searchParams.get('status') || undefined) as ChangeOrderStatus | undefined
    const reason = (searchParams.get('reason') || undefined) as ChangeOrderReason | undefined
    const orders = await getChangeOrders(project.id, { status, reason })
    return successResponse({ count: orders.length, change_orders: orders })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch change orders')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()
    if (!body.title || !body.reason) {
      return validationError('Missing required fields: title, reason')
    }

    const order = await createChangeOrder({
      project_id: project.id,
      title: body.title,
      description: body.description || '',
      category: body.category || null,
      requested_by: body.requested_by || null,
      reason: body.reason,
      status: body.status || 'draft',
      cost_impact: body.cost_impact || 0,
      schedule_impact_days: body.schedule_impact_days || null,
      affected_milestone_id: body.affected_milestone_id || null,
      affected_budget_items: body.affected_budget_items || null,
      contract_id: body.contract_id || null,
      approved_date: body.approved_date || null,
      notes: body.notes || null,
    })

    if (!order) return errorResponse(new Error('Insert failed'), 'Failed to create change order')
    return successResponse({ change_order: order })
  } catch (error) {
    return errorResponse(error, 'Failed to create change order')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.id) return validationError('Missing id')

    const { id, ...updates } = body
    const success = await updateChangeOrder(id, updates)
    return successResponse({ success })
  } catch (error) {
    return errorResponse(error, 'Failed to update change order')
  }
}
