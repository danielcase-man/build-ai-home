import { NextRequest } from 'next/server'
import { scanEmailForBidAttachments } from '@/lib/bid-ingestion-service'
import { getProject } from '@/lib/project-service'
import { getAuthenticatedGmailService } from '@/lib/gmail-auth'
import { supabase } from '@/lib/supabase'
import { successResponse, errorResponse } from '@/lib/api-utils'

/**
 * POST /api/bids/scan-emails
 * Scans recent emails with attachments for bid documents.
 * Optionally pass { email_id } to scan a specific email,
 * or omit to scan all emails with unprocessed attachments.
 */
export async function POST(request: NextRequest) {
  try {
    const project = await getProject()
    if (!project) return errorResponse(new Error('No project'), 'No project found')

    const body = await request.json().catch(() => ({}))
    const specificEmailId = body.email_id as string | undefined

    const gmailService = await getAuthenticatedGmailService()
    if (!gmailService) {
      return errorResponse(new Error('Gmail not connected'), 'Gmail authentication required')
    }

    // Find emails with attachments that haven't been processed
    let query = supabase
      .from('emails')
      .select('id, message_id, subject, sender_email')
      .eq('has_attachments', true)
      .order('received_date', { ascending: false })
      .limit(20)

    if (specificEmailId) {
      query = query.eq('id', specificEmailId)
    }

    const { data: emails } = await query
    if (!emails || emails.length === 0) {
      return successResponse({ message: 'No emails with attachments to scan', results: [] })
    }

    // Check which emails already have bid documents
    const { data: existingDocs } = await supabase
      .from('bid_documents')
      .select('email_id')
      .eq('source', 'email_attachment')
      .not('email_id', 'is', null)

    const processedEmailIds = new Set((existingDocs || []).map(d => d.email_id))

    const allResults: Array<{ email_subject: string; bids_found: number; details: Array<{ bidId: string; lineItemCount: number; filename: string }> }> = []

    for (const email of emails) {
      if (!specificEmailId && processedEmailIds.has(email.id)) continue

      const results = await scanEmailForBidAttachments(
        project.id,
        email.id,
        email.message_id,
        gmailService
      )

      if (results.length > 0) {
        allResults.push({
          email_subject: email.subject,
          bids_found: results.length,
          details: results,
        })
      }
    }

    const totalBids = allResults.reduce((sum, r) => sum + r.bids_found, 0)

    return successResponse({
      message: `Scanned ${emails.length} emails, extracted ${totalBids} bids`,
      emails_scanned: emails.length,
      bids_extracted: totalBids,
      results: allResults,
    })
  } catch (error) {
    return errorResponse(error, 'Failed to scan emails for bids')
  }
}
