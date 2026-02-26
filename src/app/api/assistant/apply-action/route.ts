/**
 * POST /api/assistant/apply-action
 *
 * Executes a user-confirmed write action (PendingAction) against the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { PendingAction } from '@/types'
import { executeAction } from '@/lib/assistant-actions'

export async function POST(req: NextRequest) {
  try {
    const action = (await req.json()) as PendingAction

    if (!action?.type || !action?.data) {
      return NextResponse.json(
        { success: false, error: 'Invalid action payload' },
        { status: 400 }
      )
    }

    const result = await executeAction(action)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Apply action error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
