import { analyzeProjectEmails, generateDraftEmails } from '@/lib/claude-email-agent'
import { db } from '@/lib/database'
import { successResponse, errorResponse } from '@/lib/api-utils'

export async function GET() {
  try {
    const storedEmails = await db.getRecentEmails(7)

    if (storedEmails.length === 0) {
      return successResponse({ drafts: [] })
    }

    const formattedEmails = storedEmails.map(email => ({
      subject: email.subject,
      from: email.sender_name ? `${email.sender_name} <${email.sender_email}>` : email.sender_email,
      body: (email.body_text || '').substring(0, 1000),
      date: email.received_date
    }))

    const projectInsights = await analyzeProjectEmails(formattedEmails)
    const drafts = await generateDraftEmails(projectInsights, formattedEmails)

    return successResponse({ drafts })
  } catch (error) {
    return errorResponse(error, 'Failed to generate draft emails')
  }
}
