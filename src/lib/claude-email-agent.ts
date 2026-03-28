import { getAnthropicClient, parseAIJsonResponse } from './ai-clients'
import type { Email, EmailInsights, ProjectInsights, DraftEmail, EmailThread } from '@/types'

/**
 * Email summarization agent using Claude Sonnet 4.6
 * Focuses on actionable intelligence for construction project management
 */
export async function summarizeEmail(email: Email): Promise<EmailInsights> {
  const prompt = `You are an AI assistant for a home construction project manager. Analyze this construction project email and extract actionable intelligence.

Email Details:
From: ${email.from}
Date: ${email.date}
Subject: ${email.subject}
Body: ${email.body}

Extract and return ONLY the following in JSON format:
{
  "actionItems": [{"item": "what needs to be done", "priority": "high/medium/low", "owner": "who should do it (if mentioned)", "deadline": "when (if mentioned)"}],
  "nextSteps": ["planned next steps mentioned"],
  "questions": [{"question": "the question", "askedBy": "who asked", "needsResponseFrom": "who needs to respond (if clear)"}],
  "keyDataPoints": [{"category": "budget/timeline/vendor/decision/permit/etc", "data": "the specific data point", "importance": "critical/important/info"}],
  "summary": "1-2 sentence summary focusing on impact to the project"
}

Focus on:
- Action items that require someone to do something
- Questions that need answers to move forward
- Key data like costs, dates, vendor names, decisions made
- What matters for project progress

Return valid JSON only, no markdown or explanation.`

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = parseAIJsonResponse(content.text) as EmailInsights
      return parsed
    }

    return getEmptyInsights()
  } catch (error) {
    console.error('Error summarizing email with Claude:', error)
    return getEmptyInsights()
  }
}

/**
 * Analyzes multiple emails to provide project-wide insights
 * Uses Claude Sonnet for better reasoning across multiple documents
 */
export async function analyzeProjectEmails(emails: Email[]): Promise<ProjectInsights> {
  if (emails.length === 0) {
    return getEmptyProjectInsights()
  }

  const recentEmails = emails.slice(0, 20)

  const emailsSummary = recentEmails.map((e, i) =>
    `EMAIL ${i + 1}:
From: ${e.from}
Date: ${e.date}
Subject: ${e.subject}
Body: ${e.body.substring(0, 800)}
---`
  ).join('\n\n')

  const prompt = `You are analyzing recent construction project emails. Extract project-wide actionable intelligence.

${emailsSummary}

Analyze ALL emails above and return ONLY the following in JSON format:
{
  "actionItems": [{"item": "what needs to be done", "priority": "high/medium/low", "source": "which email (by subject or sender)", "owner": "who (if mentioned)"}],
  "nextSteps": ["consolidated next steps for the project"],
  "openQuestions": [{"question": "unresolved question", "askedBy": "who", "needsResponseFrom": "who needs to answer"}],
  "keyDataPoints": [{"category": "budget/timeline/vendor/decision/permit/etc", "data": "specific data", "importance": "critical/important/info"}],
  "overallStatus": "2-3 sentence project status based on email patterns",
  "urgentMatters": ["things that need immediate attention"]
}

Focus on:
- Consolidate similar action items across emails
- Identify patterns and trends
- Flag urgent or time-sensitive matters
- Extract concrete data (costs, dates, vendor info, decisions)
- Questions that remain unanswered

Return valid JSON only, no markdown or explanation.`

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = parseAIJsonResponse(content.text) as ProjectInsights
      return parsed
    }

    return getEmptyProjectInsights()
  } catch (error) {
    console.error('Error analyzing project emails with Claude:', error)
    return getEmptyProjectInsights()
  }
}

/**
 * Quick email triage - determines if an email needs immediate attention
 * Uses Claude Sonnet 4.6
 */
export async function triageEmail(email: Email): Promise<{
  urgent: boolean
  priority: 'critical' | 'high' | 'medium' | 'low'
  reason: string
  suggestedAction: string
}> {
  const prompt = `Triage this construction project email for urgency.

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 500)}

Return JSON only:
{
  "urgent": true/false,
  "priority": "critical/high/medium/low",
  "reason": "why this priority",
  "suggestedAction": "immediate action needed (if urgent) or can wait"
}

Critical = project blocker, safety issue, legal deadline, major cost issue
High = decision needed this week, vendor coordination, permit deadline approaching
Medium = information needed, routine updates, scheduling
Low = FYI, documentation, routine correspondence

Return valid JSON only.`

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      temperature: 0,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return parseAIJsonResponse(content.text) as {
        urgent: boolean
        priority: 'critical' | 'high' | 'medium' | 'low'
        reason: string
        suggestedAction: string
      }
    }

    return {
      urgent: false,
      priority: 'medium',
      reason: 'Unable to analyze',
      suggestedAction: 'Manual review recommended'
    }
  } catch (error) {
    console.error('Error triaging email:', error)
    return {
      urgent: false,
      priority: 'medium',
      reason: 'Error during triage',
      suggestedAction: 'Manual review recommended'
    }
  }
}

/**
 * Generates recommended email drafts based on project insights and threaded email conversations.
 * Thread-aware: skips conversations where Daniel already replied or where the topic is stale.
 * Uses Claude Sonnet for reasoning about what emails should be sent.
 */
export async function generateDraftEmails(
  projectInsights: ProjectInsights,
  threads: EmailThread[]
): Promise<DraftEmail[]> {
  if (threads.length === 0) return []

  const today = new Date().toISOString().split('T')[0]

  // Build thread-structured context so AI sees full conversation chains
  const threadContext = threads.slice(0, 12).map((thread, ti) => {
    const msgs = thread.messages.map((m, mi) =>
      `  [${mi + 1}] ${m.direction === 'sent' ? 'DANIEL SENT' : 'RECEIVED'} | From: ${m.from} | Date: ${m.date}
  Body: ${m.body.substring(0, 500)}`
    ).join('\n')

    return `THREAD ${ti + 1}: "${thread.subject}"
Participants: ${thread.participants.join(', ')}
Last activity: ${thread.lastMessageDate}
Daniel has replied in this thread: ${thread.danielReplied ? 'YES' : 'NO'}
Messages (chronological):
${msgs}
---`
  }).join('\n\n')

  const insightsContext = JSON.stringify({
    actionItems: projectInsights.actionItems,
    openQuestions: projectInsights.openQuestions,
    urgentMatters: projectInsights.urgentMatters
  }, null, 2)

  const prompt = `You are an AI assistant helping a homeowner (Daniel Case, danielcase.info@gmail.com) manage a home construction project.

TODAY'S DATE: ${today}

Analyze the conversation threads and project insights below. Generate recommended email drafts that Daniel should send RIGHT NOW.

CRITICAL RULES — read these before generating ANY drafts:
1. **Thread awareness:** Each thread shows the FULL conversation chain. Messages marked "DANIEL SENT" are emails Daniel already sent. Do NOT recommend follow-ups on topics Daniel has already addressed in a later message within the same thread.
2. **Staleness check:** If Daniel already replied to a thread and the other party has NOT responded since Daniel's last message, a follow-up MAY be warranted ONLY if enough time has passed (3+ business days) AND the matter is still unresolved. Otherwise skip it.
3. **Current state only:** Only recommend emails that reflect the CURRENT state of each conversation as of ${today}. Do not recommend emails about topics that have already been discussed and moved past.
4. **No redundant follow-ups:** If Daniel sent a detailed email and is simply waiting for a reply (less than 3 business days), do NOT generate a follow-up. Patience is appropriate.
5. **Recency matters:** Prioritize threads with recent activity from others that Daniel has NOT yet responded to.

PROJECT INSIGHTS:
${insightsContext}

CONVERSATION THREADS:
${threadContext}

Generate up to 5 email drafts. For each, determine the correct recipient from the thread context (use actual email addresses).

Return a JSON array of draft objects:
[
  {
    "to": "recipient@email.com",
    "toName": "Recipient Name",
    "subject": "Clear subject line",
    "body": "<p>HTML formatted email body</p>",
    "reason": "Why this email should be sent NOW (reference the thread state)",
    "priority": "high/medium/low",
    "relatedActionItem": "The action item or question this addresses"
  }
]

Rules for the email body:
- Use HTML: <p> for paragraphs, <br> for line breaks, <b> for bold, <ul>/<li> for lists
- Professional but friendly tone
- Sign off as "Daniel Case" or "Daniel"
- Be specific and reference project details from the threads
- Keep emails concise and action-oriented
- Reference the current date context — do not write emails that sound like they were written days ago

If no drafts are warranted based on the current thread states, return an empty array [].
Return valid JSON only, no markdown fences or explanation.`

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type !== 'text') return []

    const parsed = parseAIJsonResponse(content.text) as Array<Omit<DraftEmail, 'id' | 'status'>>

    return parsed.map((draft, i) => ({
      ...draft,
      // P0 fix: Sanitize HTML body to prevent XSS from AI-generated content
      body: sanitizeHtml(draft.body || ''),
      id: `draft-${Date.now()}-${i}`,
      status: 'draft' as const
    }))
  } catch (error) {
    console.error('Error generating draft emails:', error)
    return []
  }
}

/** Strip dangerous HTML constructs from AI-generated email bodies */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*\S+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
}

function getEmptyInsights(): EmailInsights {
  return {
    actionItems: [],
    nextSteps: [],
    questions: [],
    keyDataPoints: [],
    summary: 'Unable to generate insights'
  }
}

function getEmptyProjectInsights(): ProjectInsights {
  return {
    actionItems: [],
    nextSteps: [],
    openQuestions: [],
    keyDataPoints: [],
    overallStatus: 'Unable to generate project insights',
    urgentMatters: []
  }
}
