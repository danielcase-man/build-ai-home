import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import { getPunchList, getPunchListStats, createPunchItem, updatePunchItem, markPunchResolved } from '@/lib/punch-list-service'
import type { PunchSeverity, PunchStatus } from '@/lib/punch-list-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return successResponse({ items: [] })

    const { searchParams } = request.nextUrl

    if (searchParams.get('view') === 'stats') {
      const stats = await getPunchListStats(project.id)
      return successResponse(stats)
    }

    const room = searchParams.get('room') || undefined
    const severity = (searchParams.get('severity') || undefined) as PunchSeverity | undefined
    const status = (searchParams.get('status') || undefined) as PunchStatus | undefined
    const category = searchParams.get('category') || undefined

    const items = await getPunchList(project.id, { room, severity, status, category })
    return successResponse({ count: items.length, items })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch punch list')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()
    if (!body.description) return validationError('Missing description')

    const item = await createPunchItem({
      project_id: project.id,
      room: body.room || null,
      location_detail: body.location_detail || null,
      category: body.category || null,
      description: body.description,
      severity: body.severity || 'functional',
      status: 'identified',
      assigned_vendor_id: body.assigned_vendor_id || null,
      assigned_vendor_name: body.assigned_vendor_name || null,
      before_photo_id: body.before_photo_id || null,
      after_photo_id: null,
      source: body.source || 'owner',
      due_date: body.due_date || null,
      completed_date: null,
      notes: body.notes || null,
    })

    if (!item) return errorResponse(new Error('Insert failed'), 'Failed to create punch item')
    return successResponse({ item })
  } catch (error) {
    return errorResponse(error, 'Failed to create punch item')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.id) return validationError('Missing id')

    if (body.action === 'resolve' && body.after_photo_id) {
      const success = await markPunchResolved(body.id, body.after_photo_id)
      return successResponse({ success })
    }

    const { id, action, ...updates } = body
    const success = await updatePunchItem(id, updates)
    return successResponse({ success })
  } catch (error) {
    return errorResponse(error, 'Failed to update punch item')
  }
}
