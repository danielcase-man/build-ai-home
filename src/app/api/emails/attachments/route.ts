import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedGmailService } from '@/lib/gmail-auth'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

/**
 * GET /api/emails/attachments?emailId=xxx
 * Returns attachment metadata for an email.
 */
export async function GET(request: NextRequest) {
  try {
    const emailId = request.nextUrl.searchParams.get('emailId')
    if (!emailId) {
      return validationError('emailId query parameter required')
    }

    const attachments = await db.getEmailAttachments(emailId)
    return successResponse({ attachments })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch attachments')
  }
}

/**
 * POST /api/emails/attachments
 * Downloads an attachment from Gmail and streams it back.
 * Body: { emailId: string, attachmentId: string, filename: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { emailId, attachmentId, filename } = await request.json()

    if (!emailId || !attachmentId) {
      return validationError('emailId and attachmentId required')
    }

    // Look up the Gmail message_id from the emails table
    const { data: email } = await supabase
      .from('emails')
      .select('message_id')
      .eq('id', emailId)
      .single()

    if (!email?.message_id) {
      return NextResponse.json(
        { success: false, error: 'Email not found' },
        { status: 404 }
      )
    }

    const gmailService = await getAuthenticatedGmailService()
    if (!gmailService) {
      return NextResponse.json(
        { success: false, error: 'Gmail authentication required' },
        { status: 401 }
      )
    }

    const buffer = await gmailService.getAttachment(email.message_id, attachmentId)
    if (!buffer) {
      return NextResponse.json(
        { success: false, error: 'Failed to download attachment' },
        { status: 404 }
      )
    }

    const safeFilename = (filename || 'attachment').replace(/[^\w.-]/g, '_')
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    return errorResponse(error, 'Failed to download attachment')
  }
}
