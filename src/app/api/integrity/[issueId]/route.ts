/**
 * PATCH /api/integrity/:issueId — Dismiss or resolve an integrity issue
 */

import { NextRequest } from 'next/server'
import { dismissIssue, resolveIssue } from '@/lib/data-integrity-agent'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const { issueId } = await params
    const body = await request.json()
    const { action, description } = body as { action: 'dismiss' | 'resolve' | 'wont_fix'; description?: string }

    if (!action) {
      return errorResponse(new Error('Missing action field'), 'Missing action field')
    }

    switch (action) {
      case 'dismiss':
        await dismissIssue(issueId)
        break
      case 'resolve':
        await resolveIssue(issueId, description || 'Manually resolved')
        break
      case 'wont_fix':
        await dismissIssue(issueId) // Uses same logic, different label handled in the function
        break
      default:
        return errorResponse(new Error(`Unknown action: ${action}`), 'Invalid action')
    }

    return successResponse({ issueId, action, success: true })
  } catch (error) {
    return errorResponse(error, 'Failed to update integrity issue')
  }
}
