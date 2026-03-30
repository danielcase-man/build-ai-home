/**
 * POST /api/coverage/pipeline
 *
 * Run the full coverage pipeline (takeoff -> normalize -> match -> score).
 *
 * Body:
 *   { category?: string, force?: boolean }
 *
 * - category: selection category name (e.g. "plumbing"). Omit to run all categories.
 * - force: if true, re-match even if matches already exist.
 *
 * Auth: dev mode or CRON_SECRET bearer token.
 */

import { NextRequest } from 'next/server'
import { runCoveragePipeline } from '@/lib/coverage-pipeline'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Auth: accept cron secret OR allow in dev mode
    const authHeader = request.headers.get('authorization')
    const isAuthed = env.cronSecret && authHeader === `Bearer ${env.cronSecret}`
    const isDev = process.env.NODE_ENV === 'development'

    if (!isAuthed && !isDev) {
      return errorResponse(new Error('Unauthorized'), 'Unauthorized')
    }

    // Parse body
    let category: string | undefined
    let force = false

    try {
      const body = await request.json()
      category = body.category || undefined
      force = body.force === true
    } catch {
      // Empty body is fine — run all categories without force
    }

    // Get project ID (single-user assumption)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!project) {
      return errorResponse(new Error('No project found'), 'No project found')
    }

    console.log(`[coverage/pipeline] Starting: category=${category || 'all'}, force=${force}`)

    const results = await runCoveragePipeline(project.id, category, { force })

    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
    console.log(
      `[coverage/pipeline] Complete: ${results.length} categories, ` +
      `${results.reduce((s, r) => s + r.matchesCreated, 0)} matches, ` +
      `${totalErrors} errors`
    )

    return successResponse(results)
  } catch (error) {
    console.error('[coverage/pipeline] Error:', error)
    return errorResponse(error, 'Coverage pipeline failed')
  }
}
