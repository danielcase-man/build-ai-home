import { NextRequest } from 'next/server'
import { summarizeEmail, analyzeProjectEmails, triageEmail } from '@/lib/claude-email-agent'
import { db } from '@/lib/database'
import { getProject } from '@/lib/project-service'
import { getAuthenticatedGmailService } from '@/lib/gmail-auth'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { AuthenticationError } from '@/lib/errors'

// Process emails in batches to avoid overwhelming the AI API
const AI_BATCH_SIZE = 3

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const forceRefresh = searchParams.get('refresh') === 'true'

    // First, try to get emails from database
    const storedEmails = await db.getRecentEmails(7)

    // If we have stored emails and not forcing refresh, return them
    if (storedEmails.length > 0 && !forceRefresh) {
      console.log(`Returning ${storedEmails.length} stored emails from database`)

      // Convert database format to frontend format
      const emailsWithSummaries = storedEmails.map(email => ({
        id: email.message_id,
        threadId: email.thread_id || '',
        subject: email.subject,
        from: email.sender_name ? `${email.sender_name} <${email.sender_email}>` : email.sender_email,
        date: email.received_date,
        body: email.body_text || '',
        snippet: email.body_text?.substring(0, 200) || '',
        aiSummary: email.ai_summary
      }))

      // Only run AI analysis if explicitly requested via ?analyze=true
      const analyze = searchParams.get('analyze') === 'true'
      let projectInsights = null
      if (analyze && emailsWithSummaries.length > 0) {
        const formattedEmails = emailsWithSummaries.map(email => ({
          subject: email.subject,
          from: email.from,
          body: email.body.substring(0, 1000),
          date: email.date
        }))
        projectInsights = await analyzeProjectEmails(formattedEmails)
      }

      return successResponse({
        emails: emailsWithSummaries,
        projectInsights,
        count: emailsWithSummaries.length,
        lastFetched: new Date().toISOString(),
        source: 'database' as const
      })
    }

    // Fall back to live Gmail API if no stored emails or forcing refresh
    console.log('Fetching emails from Gmail API...')

    const gmailService = await getAuthenticatedGmailService()
    if (!gmailService) {
      throw new AuthenticationError()
    }

    // Build search query dynamically from project contacts
    const project = await getProject()
    const searchQuery = project
      ? await db.buildEmailSearchQuery(project.id, 7)
      : 'label:inbox newer_than:7d'
    const emails = await gmailService.getEmails(searchQuery)

    // Add individual AI insights and triage in batches to avoid rate limits
    const emailsWithInsights: Array<{
      id: string; threadId: string; subject: string; from: string;
      date: string; body: string; snippet: string;
      insights: Awaited<ReturnType<typeof summarizeEmail>>;
      triage: Awaited<ReturnType<typeof triageEmail>>;
      aiSummary: string;
    }> = []

    for (let i = 0; i < emails.length; i += AI_BATCH_SIZE) {
      const batch = emails.slice(i, i + AI_BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const emailData = {
            subject: email.subject,
            from: email.from,
            body: email.body.substring(0, 2000),
            date: email.date
          }

          const [insights, triage] = await Promise.all([
            summarizeEmail(emailData),
            triageEmail(emailData)
          ])

          return {
            ...email,
            insights,
            triage,
            aiSummary: insights.summary
          }
        })
      )
      emailsWithInsights.push(...batchResults)
    }

    // Format emails for project-wide analysis
    const formattedEmails = emailsWithInsights.map(email => ({
      subject: email.subject,
      from: email.from,
      body: email.body.substring(0, 2000),
      date: email.date
    }))

    // Get project-wide insights if there are emails
    let projectInsights = null
    if (formattedEmails.length > 0) {
      projectInsights = await analyzeProjectEmails(formattedEmails)
    }

    return successResponse({
      emails: emailsWithInsights,
      projectInsights,
      count: emailsWithInsights.length,
      lastFetched: new Date().toISOString(),
      source: 'gmail-api' as const
    })
  } catch (error) {
    return errorResponse(error, 'Failed to fetch emails')
  }
}
