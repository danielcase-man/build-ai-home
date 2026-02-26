/**
 * POST /api/admin/seed
 *
 * Re-runs the document seed to populate Supabase from the Dropbox repository.
 * Protected by CRON_SECRET bearer token.
 *
 * Body (optional):
 *   { "docPath": "/custom/path/to/documents" }
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import { runSeed } from '@/lib/seed-parsers'
import { env } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    // Auth check - always require CRON_SECRET as bearer token
    const cronSecret = env.cronSecret
    if (!cronSecret) {
      return errorResponse(new Error('CRON_SECRET not configured'), 'Endpoint not available')
    }
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse(new Error('Unauthorized'), 'Invalid or missing authorization token')
    }

    const body = await request.json().catch(() => ({}))
    const docPath = body.docPath || env.documentRepositoryPath

    if (!docPath) {
      return validationError('No document path specified. Set DOCUMENT_REPOSITORY_PATH env var or pass docPath in request body.')
    }

    // Use service role key if available to bypass RLS, otherwise anon key
    const serviceKey = env.supabaseServiceRoleKey
    const supabase = createClient(
      env.supabaseUrl,
      serviceKey || env.supabaseAnonKey
    )

    const result = await runSeed(supabase, docPath)

    if (result.errors.length > 0) {
      return successResponse({
        ...result,
        warning: `Completed with ${result.errors.length} error(s)`,
      })
    }

    return successResponse(result)
  } catch (error) {
    return errorResponse(error, 'Seed operation failed')
  }
}
