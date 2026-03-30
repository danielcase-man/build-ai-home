/**
 * GET /api/integrity — Latest integrity report (score + open issues)
 * POST /api/integrity — Trigger manual integrity check
 */

import { NextRequest } from 'next/server'
import { runIntegrityCheck, getLatestIntegrityReport, getOpenIssues } from '@/lib/data-integrity-agent'
import { getProject } from '@/lib/project-service'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { env } from '@/lib/env'

export async function GET(_request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) {
      return successResponse({ message: 'No project found' })
    }

    const [latestReport, openIssues] = await Promise.all([
      getLatestIntegrityReport(project.id),
      getOpenIssues(project.id),
    ])

    return successResponse({
      latest_report: latestReport,
      open_issues: openIssues,
      open_issue_count: openIssues.length,
      integrity_score: latestReport?.integrity_score ?? null,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to get integrity report')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth: cron secret or dev mode
    const authHeader = request.headers.get('authorization')
    const isAuthed = env.cronSecret && authHeader === `Bearer ${env.cronSecret}`
    const isDev = process.env.NODE_ENV === 'development'

    if (!isAuthed && !isDev) {
      return errorResponse(new Error('Unauthorized'), 'Unauthorized')
    }

    const project = await getProject()
    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    const result = await runIntegrityCheck(project.id, { triggerType: 'manual' })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error, 'Failed to run integrity check')
  }
}
