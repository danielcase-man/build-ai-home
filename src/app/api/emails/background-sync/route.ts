import { summarizeIndividualEmail } from '@/lib/ai-summarization'
import { db } from '@/lib/database'
import { extractEmailAddress, extractSenderName } from '@/lib/ui-helpers'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { updateProjectStatus, getProject } from '@/lib/project-service'
import { getAuthenticatedGmailService } from '@/lib/gmail-auth'
import { env } from '@/lib/env'
import { createEmailSyncNotification } from '@/lib/notification-service'
import type { EmailRecord } from '@/types'

const STALENESS_MINUTES = 15

export async function POST() {
  try {
    // Check if Gmail is configured
    const emailAccount = await db.getEmailAccount(env.gmailUserEmail || '')
    if (!emailAccount) {
      return successResponse({ needed: false, reason: 'no_account' })
    }

    // Staleness check — skip if synced recently
    const lastSync = emailAccount.last_sync ? new Date(emailAccount.last_sync) : new Date(0)
    const minutesSinceSync = (Date.now() - lastSync.getTime()) / (60 * 1000)

    if (minutesSinceSync < STALENESS_MINUTES) {
      return successResponse({
        needed: false,
        reason: 'fresh',
        lastSync: emailAccount.last_sync,
        minutesAgo: Math.round(minutesSinceSync),
      })
    }

    // Get authenticated Gmail service
    const gmailService = await getAuthenticatedGmailService()
    if (!gmailService) {
      return successResponse({ needed: true, synced: 0, reason: 'no_credentials' })
    }

    const project = await getProject()
    if (!project) {
      return successResponse({ needed: true, synced: 0, reason: 'no_project' })
    }

    const projectId = project.id

    // Try incremental sync first
    const storedHistoryId = await db.getGmailHistoryId(emailAccount.email_address)
    let gmailEmails: Array<{ id: string; threadId: string; subject: string; from: string; date: string; body: string; snippet: string }> = []
    let usedIncremental = false

    if (storedHistoryId) {
      const changes = await gmailService.getHistoryChanges(storedHistoryId)

      if (changes && changes.messageIds.length > 0) {
        const fetched = await Promise.all(
          changes.messageIds.map(id => gmailService.getEmailById(id))
        )
        gmailEmails = fetched.filter((e): e is NonNullable<typeof e> => e !== null)
        usedIncremental = true
        await db.updateGmailHistoryId(emailAccount.email_address, changes.newHistoryId)
      } else if (changes && changes.messageIds.length === 0) {
        await db.updateGmailHistoryId(emailAccount.email_address, changes.newHistoryId)
        await db.updateLastSync(emailAccount.email_address)
        return successResponse({ needed: true, synced: 0, reason: 'no_new_emails' })
      }
      // If changes is null, historyId expired — fall through to full fetch
    }

    if (!usedIncremental) {
      const searchQuery = await db.buildEmailSearchQuery(projectId, 2)
      gmailEmails = await gmailService.getEmails(searchQuery)

      const profile = await gmailService.getProfile()
      if (profile?.historyId) {
        await db.updateGmailHistoryId(emailAccount.email_address, profile.historyId)
      }
    }

    if (gmailEmails.length === 0) {
      await db.updateLastSync(emailAccount.email_address)
      return successResponse({ needed: true, synced: 0, reason: 'no_new_emails' })
    }

    // Process and store new emails with AI summaries
    const emailsToStore: EmailRecord[] = []

    for (const email of gmailEmails) {
      const exists = await db.emailExists(email.id)
      if (exists) continue

      const emailData = {
        subject: email.subject,
        from: email.from,
        body: email.body.substring(0, 1000),
        date: email.date,
      }

      const aiSummary = await summarizeIndividualEmail(emailData)

      emailsToStore.push({
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
        urgency_level: 'medium',
      })
    }

    if (emailsToStore.length > 0) {
      await db.storeEmails(emailsToStore)
      await createEmailSyncNotification(projectId, emailsToStore.length)
    }

    await db.updateLastSync(emailAccount.email_address)

    // Update project status snapshot
    try {
      await updateProjectStatus(projectId)
    } catch {
      // Non-fatal — status update can fail without breaking sync
    }

    return successResponse({
      needed: true,
      synced: emailsToStore.length,
      total: gmailEmails.length,
    })
  } catch (error) {
    return errorResponse(error, 'Background sync failed')
  }
}

export async function GET() {
  return POST()
}
