import { NextRequest } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { summarizeEmail, analyzeProjectEmails, triageEmail } from '@/lib/claude-email-agent'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { AuthenticationError } from '@/lib/errors'

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

      // Format emails for overall project summary
      const formattedEmails = emailsWithSummaries.map(email => ({
        subject: email.subject,
        from: email.from,
        body: email.body.substring(0, 1000),
        date: email.date
      }))

      // Get overall AI summary if there are emails
      let projectInsights = null
      if (formattedEmails.length > 0) {
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

    const cookieStore = await cookies()
    const accessToken = cookieStore.get('gmail_access_token')
    const refreshToken = cookieStore.get('gmail_refresh_token')

    if (!accessToken) {
      throw new AuthenticationError()
    }

    const gmailService = new GmailService()
    gmailService.setCredentials({
      access_token: accessToken.value,
      refresh_token: refreshToken?.value
    })

    // Build search query dynamically from project contacts
    const projectId = await db.getOrCreateProject()
    const searchQuery = projectId
      ? await db.buildEmailSearchQuery(projectId, 7)
      : 'label:inbox newer_than:7d'
    const emails = await gmailService.getEmails(searchQuery)

    // Add individual AI insights and triage to each email
    const emailsWithInsights = await Promise.all(
      emails.map(async (email) => {
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
