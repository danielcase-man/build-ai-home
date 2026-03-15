import { NextRequest, NextResponse } from 'next/server'
import { syncAllConnections } from '@/lib/plaid-sync'
import { getProject } from '@/lib/project-service'

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const project = await getProject()
    if (!project?.id) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 })
    }

    const result = await syncAllConnections(project.id)

    console.log(`[cron/sync-transactions] +${result.added} ~${result.modified} -${result.removed} matched:${result.autoMatched} errors:${result.errors.length}`)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[cron/sync-transactions] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}

// Vercel Cron hits GET
export async function GET(request: NextRequest) {
  return POST(request)
}
