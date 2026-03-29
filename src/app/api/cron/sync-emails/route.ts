import { NextRequest } from 'next/server'
import { classifyAndSummarizeEmail } from '@/lib/ai-summarization'
import { classifyAndSummarizeEmailRuleBased } from '@/lib/email-classifier'
import { db } from '@/lib/database'
import { extractEmailAddress, extractSenderName } from '@/lib/ui-helpers'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { updateProjectStatus, getProject } from '@/lib/project-service'
import { getAuthenticatedGmailService } from '@/lib/gmail-auth'
import { AuthenticationError } from '@/lib/errors'
import { env } from '@/lib/env'
import { createEmailSyncNotification } from '@/lib/notification-service'
import { detectAndUpdateLoanStatus } from '@/lib/loan-status-detection'
import { detectAndUpdateLoanStatusRuleBased } from '@/lib/loan-status-rules'
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

    // Check if we need to sync (respect sync frequency)
    const emailAccount = await db.getEmailAccount(env.gmailUserEmail || '')
    if (!emailAccount) {
      console.log('No configured email account found')
      return successResponse({
        message: 'No email accounts configured for syncing',
        synced: 0
      })
    }

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

    // Get authenticated Gmail service (handles decryption + token refresh + persist)
    const gmailService = await getAuthenticatedGmailService()
    if (!gmailService) {
      console.log('No valid Gmail credentials found')
      return successResponse({
        message: 'Gmail authentication not available',
        synced: 0
      })
    }

    // Get project ID
    const project = await getProject()
    if (!project) {
      throw new Error('No project found')
    }
    const projectId = project.id

    // Try incremental sync first using Gmail history API
    const storedHistoryId = await db.getGmailHistoryId(emailAccount.email_address)
    let gmailEmails: Array<{ id: string; threadId: string; subject: string; from: string; date: string; body: string; snippet: string }> = []
    let usedIncremental = false

    if (storedHistoryId) {
      console.log(`Attempting incremental sync from historyId ${storedHistoryId}...`)
      const changes = await gmailService.getHistoryChanges(storedHistoryId)

      if (changes && changes.messageIds.length > 0) {
        console.log(`Incremental sync found ${changes.messageIds.length} new messages`)
        const fetched = await Promise.all(
          changes.messageIds.map(id => gmailService.getEmailById(id))
        )
        gmailEmails = fetched.filter((e): e is NonNullable<typeof e> => e !== null)
        usedIncremental = true

        // Update stored history ID
        await db.updateGmailHistoryId(emailAccount.email_address, changes.newHistoryId)
      } else if (changes && changes.messageIds.length === 0) {
        // No new messages — update history ID and return
        await db.updateGmailHistoryId(emailAccount.email_address, changes.newHistoryId)
        await db.updateLastSync(emailAccount.email_address)
        return successResponse({ message: 'No new emails (incremental)', synced: 0 })
      }
      // If changes is null, historyId expired — fall through to full fetch
    }

    if (!usedIncremental) {
      // Full fetch fallback
      console.log('Building email search query from contacts...')
      const searchQuery = await db.buildEmailSearchQuery(projectId, 2)

      console.log('Fetching emails from Gmail (full)...')
      gmailEmails = await gmailService.getEmails(searchQuery)

      // Store current historyId for future incremental syncs
      const profile = await gmailService.getProfile()
      if (profile?.historyId) {
        await db.updateGmailHistoryId(emailAccount.email_address, profile.historyId)
      }
    }

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

      // Fast rule-based pre-filter: skip obvious noise before AI processing
      const ruleResult = await classifyAndSummarizeEmailRuleBased(emailData, projectId)
      if (ruleResult.category === 'other' && ruleResult.confidence >= 0.90) {
        console.log(`Skipping noise (${ruleResult.rule}): ${email.subject}`)
        continue
      }

      // AI-powered classification + summary for construction-relevant emails
      console.log(`AI classifying: ${email.subject}`)
      const { summary: aiSummary, category } = await classifyAndSummarizeEmail(emailData)

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
        ai_summary: aiSummary || 'Unable to generate summary',
        category: category || ruleResult.category,
        has_attachments: false,
        urgency_level: 'medium'
      }

      emailsToStore.push(emailRecord)
    }

    // Store emails in database
    if (emailsToStore.length > 0) {
      console.log(`Storing ${emailsToStore.length} new emails...`)
      await db.storeEmails(emailsToStore)

      // Notify about new emails
      await createEmailSyncNotification(projectId, emailsToStore.length)
    }

    // Update last sync time
    await db.updateLastSync(emailAccount.email_address)

    // Update project status snapshot from recent emails
    try {
      console.log('Generating project status snapshot...')
      await updateProjectStatus(projectId)
      console.log('Project status snapshot updated')
    } catch (statusError) {
      console.error('Failed to update project status (non-fatal):', statusError)
    }

    // Reconcile project state from evidence (milestones, planning steps, vendor statuses)
    try {
      const { ProjectReconciler } = await import('@/lib/reconciler')
      const reconciler = new ProjectReconciler(projectId)
      const reconcileResult = await reconciler.reconcileAll()
      if (reconcileResult.changes.length > 0) {
        console.log(`Reconciler: ${reconcileResult.changes.length} updates (${reconcileResult.duration}ms)`)
        reconcileResult.changes.forEach(c => console.log(`  ${c.entity_type} "${c.entity_name}": ${c.old_value} → ${c.new_value} (${c.reason})`))
      }
    } catch (reconcileErr) {
      console.error('Reconciler failed (non-fatal):', reconcileErr)
    }

    // Detect loan status changes from new emails (AI first, rule-based fallback)
    if (emailsToStore.length > 0) {
      try {
        console.log('Checking for loan status updates...')
        const loanEmails = emailsToStore.map(e => ({
          from: `${e.sender_name || ''} <${e.sender_email || ''}>`,
          subject: e.subject || '',
          body: e.body_text || '',
          date: e.received_date || '',
        }))

        let loanUpdate: { updated: boolean; reason?: string }
        try {
          loanUpdate = await detectAndUpdateLoanStatus(projectId, loanEmails)
        } catch {
          // AI failed — fall back to rule-based
          loanUpdate = await detectAndUpdateLoanStatusRuleBased(projectId, loanEmails)
        }

        if (loanUpdate.updated) {
          console.log(`Loan status auto-updated: ${loanUpdate.reason}`)
        }
      } catch (loanError) {
        console.error('Loan status detection failed (non-fatal):', loanError)
      }
    }

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
