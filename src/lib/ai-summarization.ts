import { getAnthropicClient, parseAIJsonResponse } from './ai-clients'
import type { Email, ProjectSummary } from '@/types'

const MODEL = 'claude-sonnet-4-5-20250929'
const HAIKU_MODEL = 'claude-haiku-3-5-20241022'

export async function summarizeIndividualEmail(email: Email): Promise<string> {
  const prompt = `Provide a brief 2-3 sentence summary of this construction project email.
Focus on the key points, action items, or decisions mentioned.

From: ${email.from}
Date: ${email.date}
Subject: ${email.subject}
Body: ${email.body}`

  try {
    const response = await getAnthropicClient().messages.create({
      model: HAIKU_MODEL,
      max_tokens: 200,
      temperature: 0.3,
      system: 'You are a construction project manager assistant. Provide concise, actionable summaries of construction-related emails.',
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') return content.text
    return 'Unable to generate summary'
  } catch (error) {
    console.error('Error summarizing individual email:', error)
    return 'Unable to generate summary'
  }
}

export async function summarizeEmails(emails: Email[]): Promise<ProjectSummary> {
  const prompt = `You are analyzing construction project emails for a home being built with UBuildIt.

Analyze the following emails and extract:
1. Hot topics that need immediate attention
2. Action items that need to be completed
3. Decisions that have been made
4. Any concerns or issues raised
5. Next steps discussed
6. An overall status assessment

Emails:
${emails.map(e => `
From: ${e.from}
Date: ${e.date}
Subject: ${e.subject}
Body: ${e.body}
`).join('\n---\n')}

Provide the response in JSON format with keys: hotTopics, actionItems, decisions, concerns, nextSteps, overallStatus.
Return valid JSON only, no markdown fences.`

  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0.2,
      system: 'You are a construction project manager assistant helping to summarize project communications. Always respond with valid JSON.',
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      let jsonText = content.text.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json?\n/, '').replace(/\n```$/, '')
      }
      return JSON.parse(jsonText) as ProjectSummary
    }

    return getEmptySummary()
  } catch (error) {
    console.error('Error summarizing emails:', error)
    return getEmptySummary()
  }
}

export async function generateDailyProjectSummary(
  projectData: { phase: string; currentStep: number; totalSteps: number; daysElapsed: number; totalDays: number; budgetUsed: number; budgetTotal: number },
  recentEmails: Email[],
  recentActivity: Record<string, unknown>
): Promise<string> {
  const prompt = `Generate a friendly, concise daily project status summary for a homeowner's spouse who wants to stay informed but isn't involved in day-to-day details.

Current Project Status:
- Phase: ${projectData.phase}
- Progress: ${projectData.currentStep} of ${projectData.totalSteps} steps
- Days: ${projectData.daysElapsed} of ${projectData.totalDays}
- Budget: $${projectData.budgetUsed} of $${projectData.budgetTotal}

Recent Emails Summary:
${recentEmails.map(e => `${e.from}: ${e.subject}`).join('\n')}

Recent Activity:
${JSON.stringify(recentActivity, null, 2)}

Write a 2-3 paragraph summary that:
1. Explains the current status in simple terms
2. Highlights any important decisions or changes
3. Notes what's coming up next
4. Maintains a positive but realistic tone`

  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 600,
      temperature: 0.7,
      system: 'You are a friendly project assistant writing daily summaries for family members to stay informed about their home construction project.',
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') return content.text
    return 'Summary generation in progress...'
  } catch (error) {
    console.error('Error generating daily summary:', error)
    return 'Unable to generate summary at this time.'
  }
}

export interface ActionItemSnapshot {
  status: string
  text: string
  action_type?: 'draft_email' | null
  action_context?: {
    to?: string
    to_name?: string
    subject_hint?: string
    context?: string
  }
}

export interface ProjectStatusSnapshot {
  hot_topics: Array<{ priority: string; text: string }>
  action_items: ActionItemSnapshot[]
  recent_decisions: Array<{ decision: string; impact: string }>
  ai_summary: string
}

export async function generateProjectStatusSnapshot(
  emails: Email[],
  projectContext: {
    phase: string
    currentStep: number
    totalSteps: number
    budgetUsed: number
    budgetTotal: number
  },
  previousStatus?: {
    hot_topics: unknown[]
    action_items: unknown[]
    recent_decisions: unknown[]
    ai_summary: string
    date: string
  } | null
): Promise<ProjectStatusSnapshot> {
  const truncatedEmails = emails.slice(0, 20).map(e => ({
    from: e.from,
    date: e.date,
    subject: e.subject,
    body: e.body.substring(0, 500)
  }))

  const previousStatusSection = previousStatus
    ? `PREVIOUS STATUS REPORT (${previousStatus.date}):
Hot Topics: ${JSON.stringify(previousStatus.hot_topics)}
Action Items: ${JSON.stringify(previousStatus.action_items)}
Recent Decisions: ${JSON.stringify(previousStatus.recent_decisions)}
Summary: ${previousStatus.ai_summary}`
    : 'PREVIOUS STATUS REPORT: This is the first report — no previous status exists.'

  const emailSection = truncatedEmails.length > 0
    ? `NEW EMAILS SINCE LAST UPDATE:
${truncatedEmails.map(e => `
From: ${e.from}
Date: ${e.date}
Subject: ${e.subject}
Body: ${e.body}
`).join('\n---\n')}`
    : 'NEW EMAILS SINCE LAST UPDATE: No new emails since last report.'

  const prompt = `You are updating a running project status report for a home construction project.

PROJECT OVERVIEW:
- Phase: ${projectContext.phase}
- Progress: Step ${projectContext.currentStep} of ${projectContext.totalSteps}
- Budget: $${projectContext.budgetUsed.toLocaleString()} used of $${projectContext.budgetTotal.toLocaleString()}

${previousStatusSection}

${emailSection}

INSTRUCTIONS:
- KEEP relevant hot topics from the previous report, REMOVE any that are clearly resolved, ADD new ones from emails
- UPDATE action item statuses based on email content, ADD new action items, KEEP unresolved items from previous report
- KEEP all previous decisions, ADD any new decisions found in emails
- REWRITE the summary to incorporate both previous context and new information into a coherent 2-3 paragraph narrative

Return a JSON object with exactly these keys:
- "hot_topics": array of {"priority": "high"|"medium"|"low", "text": "description"}
- "action_items": array of action item objects. Each has:
  - "status": "pending"|"in-progress"|"completed"
  - "text": description of what needs to be done
  - "action_type": set to "draft_email" if this item requires sending an email (e.g. requesting info, following up, responding to someone). Set to null otherwise.
  - "action_context": only include when action_type is "draft_email". Object with:
    - "to": recipient email address (extract from the emails above)
    - "to_name": recipient name
    - "subject_hint": suggested email subject line
    - "context": brief description of what the email should cover
- "recent_decisions": array of {"decision": "what was decided", "impact": "why it matters"}
- "ai_summary": a 2-3 paragraph narrative summary of current project status

Return valid JSON only, no markdown fences.`

  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
      max_tokens: 3000,
      temperature: 0.2,
      system: 'You are a construction project manager maintaining a running status report. Respond with valid JSON only.',
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = parseAIJsonResponse(content.text) as ProjectStatusSnapshot
      return {
        hot_topics: parsed.hot_topics || [],
        action_items: parsed.action_items || [],
        recent_decisions: parsed.recent_decisions || [],
        ai_summary: parsed.ai_summary || 'Summary not available'
      }
    }

    return getEmptySnapshot()
  } catch (error) {
    console.error('Error generating project status snapshot:', error)
    return getEmptySnapshot()
  }
}

function getEmptySnapshot(): ProjectStatusSnapshot {
  return {
    hot_topics: [],
    action_items: [],
    recent_decisions: [],
    ai_summary: 'Unable to generate project status snapshot at this time.'
  }
}

function getEmptySummary(): ProjectSummary {
  return {
    hotTopics: [],
    actionItems: [],
    decisions: [],
    concerns: [],
    nextSteps: [],
    overallStatus: 'Unable to generate summary'
  }
}
