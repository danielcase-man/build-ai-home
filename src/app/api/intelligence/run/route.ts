/**
 * POST /api/intelligence/run
 *
 * Run the Incremental Intelligence Engine.
 * Scans all data sources for changes, routes to domain agents,
 * and updates the dashboard. Replaces the "Generate AI Report" button.
 *
 * Query params:
 *   ?sources=dropbox,gmail  — limit to specific sources
 *   ?force=true             — ignore watermark intervals
 *   ?backlog=true           — also process pending files from prior scans
 *
 * Auth: Bearer token (CRON_SECRET) for cron, or no auth for manual (dev).
 */

import { NextRequest } from 'next/server'
import { runIntelligenceEngine } from '@/lib/intelligence-engine'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { env } from '@/lib/env'
import type { IntelligenceSource } from '@/types'

const VALID_SOURCES: IntelligenceSource[] = ['gmail', 'dropbox', 'jobtread', 'manual']

export async function POST(request: NextRequest) {
  try {
    // Auth: accept cron secret OR allow in dev mode
    const authHeader = request.headers.get('authorization')
    const isAuthed = env.cronSecret && authHeader === `Bearer ${env.cronSecret}`
    const isDev = process.env.NODE_ENV === 'development'

    if (!isAuthed && !isDev) {
      return errorResponse(new Error('Unauthorized'), 'Unauthorized')
    }

    // Parse options from query params
    const { searchParams } = new URL(request.url)
    const sourcesParam = searchParams.get('sources')
    const force = searchParams.get('force') === 'true'
    const processBacklog = searchParams.get('backlog') === 'true'

    const sources = sourcesParam
      ? sourcesParam.split(',').filter((s): s is IntelligenceSource => VALID_SOURCES.includes(s as IntelligenceSource))
      : undefined

    // Determine trigger type
    const triggerType = authHeader ? 'cron' as const : 'manual' as const

    console.log(`[intelligence/run] Starting: sources=${sources?.join(',') || 'all'}, force=${force}, backlog=${processBacklog}, trigger=${triggerType}`)

    const result = await runIntelligenceEngine({
      sources,
      force,
      processBacklog,
      triggerType,
    })

    return successResponse(result)
  } catch (error) {
    console.error('[intelligence/run] Error:', error)
    return errorResponse(error, 'Intelligence engine failed')
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
