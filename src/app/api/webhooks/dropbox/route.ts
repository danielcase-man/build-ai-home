/**
 * Dropbox Webhook Endpoint
 *
 * GET  — Responds to Dropbox verification challenge
 * POST — Receives file change notifications, triggers intelligence engine
 *
 * Setup:
 * 1. Create a Dropbox App at https://www.dropbox.com/developers/apps
 * 2. Set permissions: files.metadata.read, files.content.read
 * 3. Generate access token, set DROPBOX_ACCESS_TOKEN env var
 * 4. Copy app secret, set DROPBOX_APP_SECRET env var
 * 5. Register webhook URI: https://{domain}/api/webhooks/dropbox
 *
 * Flow:
 * 1. Dropbox sends notification (just user IDs, not file details)
 * 2. We fetch actual changes via list_folder/continue with stored cursor
 * 3. New/modified files are added to file_inventory as pending
 * 4. Intelligence engine is triggered to process them
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase } from '@/lib/supabase'
import { classifyFileByPath } from '@/lib/agent-router'

const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET || ''
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN || ''
const DROPBOX_PROJECT_PATH = '/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove'

const PROCESSABLE_EXTENSIONS = new Set([
  '.pdf', '.xlsx', '.xls', '.doc', '.docx', '.csv',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.txt', '.md', '.html',
])

/**
 * GET — Dropbox verification challenge.
 * Dropbox sends ?challenge=xxx, we echo it back.
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge')

  if (!challenge) {
    return NextResponse.json({ error: 'Missing challenge parameter' }, { status: 400 })
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/**
 * POST — Dropbox file change notification.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    // Verify signature if app secret is configured
    if (DROPBOX_APP_SECRET) {
      const signature = request.headers.get('x-dropbox-signature')
      if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }

      const computed = crypto
        .createHmac('sha256', DROPBOX_APP_SECRET)
        .update(body)
        .digest('hex')

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed))) {
        console.error('[dropbox-webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Respond immediately (Dropbox expects <10s response)
    // Process changes asynchronously
    const notification = JSON.parse(body)
    console.log('[dropbox-webhook] Received notification:', JSON.stringify(notification))

    // Fetch actual changes in background
    processDropboxChanges().catch(err => {
      console.error('[dropbox-webhook] Background processing failed:', err)
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[dropbox-webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

/**
 * Fetch changes from Dropbox API using stored cursor.
 */
async function processDropboxChanges(): Promise<void> {
  if (!DROPBOX_ACCESS_TOKEN) {
    console.warn('[dropbox-webhook] No DROPBOX_ACCESS_TOKEN configured, skipping')
    return
  }

  // Get stored cursor
  const { data: watermark } = await supabase
    .from('source_watermarks')
    .select('metadata')
    .eq('source', 'dropbox_webhook')
    .single()

  const cursor = watermark?.metadata?.cursor as string | undefined

  let response: Response
  let result: DropboxListFolderResult

  if (cursor) {
    // Continue from last cursor
    response = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursor }),
    })
  } else {
    // First time — get initial cursor
    response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: DROPBOX_PROJECT_PATH,
        recursive: true,
        include_deleted: false,
      }),
    })
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[dropbox-webhook] Dropbox API error:', response.status, errorText)

    // If cursor is expired, reset and do a full scan
    if (response.status === 409 && errorText.includes('reset')) {
      console.log('[dropbox-webhook] Cursor expired, resetting...')
      await saveCursor(null)
    }
    return
  }

  result = await response.json() as DropboxListFolderResult

  // Process file entries
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .limit(1)
    .single()

  const projectId = project?.id
  if (!projectId) {
    console.error('[dropbox-webhook] No project found')
    return
  }

  let totalNew = 0
  let totalModified = 0

  do {
    for (const entry of result.entries) {
      if (entry['.tag'] !== 'file') continue

      const ext = '.' + (entry.name.split('.').pop()?.toLowerCase() || '')
      if (!PROCESSABLE_EXTENSIONS.has(ext)) continue

      // Skip temp files
      if (entry.name.startsWith('~$')) continue

      const filePath = entry.path_display || entry.path_lower
      const domain = classifyFileByPath(filePath, entry.name)

      // Upsert to file_inventory
      const { error } = await supabase
        .from('file_inventory')
        .upsert({
          project_id: projectId,
          file_path: filePath,
          file_name: entry.name,
          file_type: ext.replace('.', ''),
          file_size: entry.size || 0,
          modified_at: entry.server_modified || new Date().toISOString(),
          folder_category: extractFolder(filePath),
          processing_status: 'pending',
          agent_domain: domain,
        }, { onConflict: 'file_path' })

      if (!error) {
        totalNew++
      }
    }

    // Continue if more results
    if (result.has_more) {
      const nextResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cursor: result.cursor }),
      })

      if (!nextResponse.ok) break
      result = await nextResponse.json() as DropboxListFolderResult
    }
  } while (result.has_more)

  // Save cursor for next time
  await saveCursor(result.cursor)

  console.log(`[dropbox-webhook] Processed: ${totalNew} new/modified files`)

  // Trigger intelligence engine if there are new files
  if (totalNew > 0) {
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

      await fetch(`${baseUrl}/api/intelligence/run?sources=dropbox&backlog=true&force=true`, {
        method: 'POST',
        headers: process.env.CRON_SECRET
          ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
          : {},
      })
      console.log('[dropbox-webhook] Intelligence engine triggered')
    } catch (err) {
      console.error('[dropbox-webhook] Failed to trigger intelligence engine:', err)
    }
  }
}

function extractFolder(filePath: string): string {
  const parts = filePath.split('/')
  parts.pop() // Remove filename
  return parts.slice(-3).join('/')
}

async function saveCursor(cursor: string | null): Promise<void> {
  await supabase
    .from('source_watermarks')
    .upsert({
      source: 'dropbox_webhook',
      last_processed_at: new Date().toISOString(),
      metadata: cursor ? { cursor } : {},
    }, { onConflict: 'source' })
}

// Dropbox API types
interface DropboxListFolderResult {
  entries: Array<{
    '.tag': 'file' | 'folder' | 'deleted'
    name: string
    path_lower: string
    path_display: string
    id: string
    rev?: string
    size?: number
    server_modified?: string
    client_modified?: string
  }>
  cursor: string
  has_more: boolean
}
