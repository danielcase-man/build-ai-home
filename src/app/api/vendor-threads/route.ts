import { NextRequest } from 'next/server'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { getProject } from '@/lib/project-service'
import {
  getVendorThreads,
  getThreadTimeline,
  getFollowUpsNeeded,
  autoLinkEmails,
  createVendorThread,
  updateVendorThread,
  markBidReceived,
} from '@/lib/vendor-thread-service'

export async function GET(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return successResponse({ threads: [] })

    const { searchParams } = request.nextUrl
    const threadId = searchParams.get('id')
    const view = searchParams.get('view')
    const status = searchParams.get('status') || undefined
    const category = searchParams.get('category') || undefined

    if (threadId) {
      const { thread, timeline } = await getThreadTimeline(threadId)
      return successResponse({ thread, timeline })
    }

    if (view === 'follow_ups') {
      const threshold = parseInt(searchParams.get('threshold') || '5')
      const followUps = await getFollowUpsNeeded(project.id, threshold)
      return successResponse({
        count: followUps.length,
        follow_ups: followUps.map(f => ({
          vendor_name: f.thread.vendor_name,
          vendor_email: f.thread.vendor_email,
          category: f.thread.category,
          days_waiting: f.days_waiting,
          reason: f.reason,
          thread_id: f.thread.id,
        })),
      })
    }

    const threads = await getVendorThreads(project.id, { status, category })
    return successResponse({
      count: threads.length,
      threads: threads.map(t => ({
        id: t.id,
        vendor_name: t.vendor_name,
        vendor_email: t.vendor_email,
        category: t.category,
        status: t.status,
        days_since_contact: t.days_since_contact,
        follow_up_date: t.follow_up_date,
        bid_requested_date: t.bid_requested_date,
        bid_received_date: t.bid_received_date,
        last_activity: t.last_activity,
        notes: t.notes,
      })),
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch vendor threads')
  }
}

export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json()

    if (body.action === 'auto_link') {
      const result = await autoLinkEmails(project.id)
      return successResponse(result)
    }

    if (!body.vendor_name) {
      return validationError('Missing required field: vendor_name')
    }

    const thread = await createVendorThread({
      project_id: project.id,
      vendor_id: body.vendor_id || null,
      contact_id: body.contact_id || null,
      vendor_name: body.vendor_name,
      vendor_email: body.vendor_email || null,
      category: body.category || null,
      status: body.status || 'active',
      last_activity: new Date().toISOString(),
      follow_up_date: body.follow_up_date || null,
      bid_requested_date: body.bid_requested_date || null,
      bid_received_date: body.bid_received_date || null,
      contract_id: body.contract_id || null,
      notes: body.notes || null,
    })

    if (!thread) {
      return errorResponse(new Error('Insert failed'), 'Failed to create vendor thread')
    }

    return successResponse({ thread })
  } catch (error) {
    return errorResponse(error, 'Failed to create vendor thread')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.thread_id) {
      return validationError('Missing thread_id')
    }

    if (body.action === 'mark_bid_received') {
      const success = await markBidReceived(body.thread_id, body.received_date)
      return successResponse({ success })
    }

    const { thread_id, ...updates } = body
    const success = await updateVendorThread(thread_id, updates)
    return successResponse({ success })
  } catch (error) {
    return errorResponse(error, 'Failed to update vendor thread')
  }
}
