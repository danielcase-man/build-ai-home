import { analyzeProjectEmails, generateDraftEmails } from '@/lib/claude-email-agent'
import { db } from '@/lib/database'
import { successResponse, errorResponse } from '@/lib/api-utils'
import type { ThreadedEmail, EmailThread } from '@/types'

const DANIEL_EMAIL = 'danielcase.info@gmail.com'

/** Group flat emails into conversation threads sorted by last activity */
function groupEmailsByThread(emails: ThreadedEmail[]): EmailThread[] {
  const threadMap = new Map<string, ThreadedEmail[]>()

  for (const email of emails) {
    const key = email.threadId || email.subject // fallback for missing threadId
    const existing = threadMap.get(key) || []
    existing.push(email)
    threadMap.set(key, existing)
  }

  const threads: EmailThread[] = []
  for (const [threadId, messages] of threadMap) {
    // Sort messages within thread chronologically (oldest first)
    messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const participants = [...new Set(messages.map(m => m.from))]
    const lastMsg = messages[messages.length - 1]
    const danielReplied = messages.some(m => m.direction === 'sent')

    threads.push({
      threadId,
      subject: messages[0].subject,
      participants,
      messages,
      lastMessageDate: lastMsg.date,
      danielReplied,
    })
  }

  // Sort threads by last message date descending (most recent first)
  threads.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime())

  return threads
}

export async function GET() {
  try {
    // Use 14-day window to capture full thread context (replies to older messages)
    const storedEmails = await db.getRecentEmails(14)

    if (storedEmails.length === 0) {
      return successResponse({ drafts: [] })
    }

    // Build threaded email list with sent/received direction
    const threadedEmails: ThreadedEmail[] = storedEmails.map(email => ({
      subject: email.subject,
      from: email.sender_name ? `${email.sender_name} <${email.sender_email}>` : email.sender_email,
      body: (email.body_text || '').substring(0, 1000),
      date: email.received_date,
      threadId: email.thread_id || '',
      direction: email.sender_email.toLowerCase() === DANIEL_EMAIL ? 'sent' : 'received',
    }))

    // Also pass flat recent emails for project insight analysis (last 7 days for relevance)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentForInsights = threadedEmails
      .filter(e => new Date(e.date) >= sevenDaysAgo)
      .map(({ subject, from, body, date }) => ({ subject, from, body, date }))

    const projectInsights = await analyzeProjectEmails(recentForInsights)

    // Group into threads for draft generation
    const threads = groupEmailsByThread(threadedEmails)

    const drafts = await generateDraftEmails(projectInsights, threads)

    return successResponse({ drafts })
  } catch (error) {
    return errorResponse(error, 'Failed to generate draft emails')
  }
}
