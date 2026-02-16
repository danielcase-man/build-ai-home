import { NextRequest } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { summarizeIndividualEmail } from '@/lib/openai'
import { db } from '@/lib/database'
import { extractEmailAddress, extractSenderName } from '@/lib/ui-helpers'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { AuthenticationError } from '@/lib/errors'
import { env } from '@/lib/env'
import type { EmailRecord } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = request.headers.get('authorization')
    const cronSecret = env.cronSecret

    if (!cronSecret) {
      console.error('CRON_SECRET environment variable is not configured')
      return errorResponse(new AuthenticationError('Cron endpoint not configured'), 'Unauthorized')
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse(new AuthenticationError(), 'Unauthorized')
    }

    console.log('Starting automated email sync...')

    // Get all email accounts that need syncing
    const emailAccount = await db.getEmailAccount(env.gmailUserEmail || '')

    if (!emailAccount || !emailAccount.oauth_tokens) {
      console.log('No configured email account found')
      return successResponse({
        message: 'No email accounts configured for syncing',
        synced: 0
      })
    }

    // Check if we need to sync (respect sync frequency)
    const lastSync = emailAccount.last_sync ? new Date(emailAccount.last_sync) : new Date(0)
    const syncFrequency = emailAccount.sync_frequency || 30
    const nextSyncTime = new Date(lastSync.getTime() + syncFrequency * 60 * 1000)

    if (new Date() < nextSyncTime) {
      console.log(`Sync not needed yet. Next sync: ${nextSyncTime}`)
      return successResponse({
        message: 'Sync not needed yet',
        nextSync: nextSyncTime
      })
    }

    // Initialize Gmail service with stored tokens
    const gmailService = new GmailService()
    gmailService.setCredentials(emailAccount.oauth_tokens)

    // Get project ID
    const projectId = await db.getOrCreateProject()
    if (!projectId) {
      throw new Error('Could not get or create project')
    }

    // Fetch emails from Gmail (only new ones since last sync)
    const searchQuery = '(from:(mike.trevino@ubuildit.com OR harry.savio@ubuildit.com OR aaron.mischenko@ubuildit.com OR @ubuildit.com OR @kippflores.com OR @krystinik.com) OR "708 Purple Salvia Cove") newer_than:2d'

    console.log('Fetching emails from Gmail...')
    const gmailEmails = await gmailService.getEmails(searchQuery)

    if (gmailEmails.length === 0) {
      await db.updateLastSync(emailAccount.email_address)
      return successResponse({
        message: 'No new emails found',
        synced: 0
      })
    }

    console.log(`Found ${gmailEmails.length} emails to process`)

    // Convert Gmail emails to database format and generate AI summaries
    const emailsToStore: EmailRecord[] = []

    for (const email of gmailEmails) {
      const exists = await db.emailExists(email.id)
      if (exists) {
        console.log(`Email ${email.id} already exists, skipping`)
        continue
      }

      const emailData = {
        subject: email.subject,
        from: email.from,
        body: email.body.substring(0, 1000),
        date: email.date
      }

      console.log(`Generating AI summary for: ${email.subject}`)
      const aiSummary = await summarizeIndividualEmail(emailData)

      const emailRecord: EmailRecord = {
        project_id: projectId,
        email_account_id: emailAccount.id,
        message_id: email.id,
        thread_id: email.threadId,
        sender_email: extractEmailAddress(email.from),
        sender_name: extractSenderName(email.from),
        subject: email.subject,
        body_text: email.body,
        received_date: email.date,
        ai_summary: aiSummary,
        has_attachments: false,
        urgency_level: 'medium'
      }

      emailsToStore.push(emailRecord)
    }

    // Store emails in database
    if (emailsToStore.length > 0) {
      console.log(`Storing ${emailsToStore.length} new emails...`)
      await db.storeEmails(emailsToStore)
    }

    // Update last sync time
    await db.updateLastSync(emailAccount.email_address)

    console.log(`Email sync completed. Processed ${emailsToStore.length} new emails`)

    return successResponse({
      message: 'Email sync completed successfully',
      synced: emailsToStore.length,
      total_processed: gmailEmails.length
    })

  } catch (error) {
    return errorResponse(error, 'Email sync failed')
  }
}

// Allow GET for testing purposes
export async function GET(request: NextRequest) {
  return POST(request)
}
