import { NextRequest, NextResponse } from 'next/server'
import { syncAllConnections } from '@/lib/plaid-sync'
import { supabase } from '@/lib/supabase'

/**
 * Plaid webhook handler.
 * Plaid sends webhooks for TRANSACTIONS events like SYNC_UPDATES_AVAILABLE.
 * This triggers a sync without waiting for the daily cron.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { webhook_type, webhook_code, item_id } = body

    console.log(`Plaid webhook: ${webhook_type}/${webhook_code} for item ${item_id}`)

    if (webhook_type === 'TRANSACTIONS') {
      if (webhook_code === 'SYNC_UPDATES_AVAILABLE' || webhook_code === 'DEFAULT_UPDATE') {
        // Find the project for this item
        const { data: connection } = await supabase
          .from('plaid_connections')
          .select('project_id')
          .eq('item_id', item_id)
          .single()

        if (connection) {
          const result = await syncAllConnections(connection.project_id)
          console.log(`Webhook sync complete: +${result.added} ~${result.modified} -${result.removed} matched:${result.autoMatched}`)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Plaid webhook error:', error)
    return NextResponse.json({ received: true }, { status: 200 }) // Always 200 to Plaid
  }
}
