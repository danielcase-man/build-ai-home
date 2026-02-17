import { getAnthropicClient } from './ai-clients'
import type { Email, ProjectSummary } from '@/types'

const MODEL = 'claude-sonnet-4-5-20250929'

export async function summarizeIndividualEmail(email: Email): Promise<string> {
  const prompt = `Provide a brief 2-3 sentence summary of this construction project email.
Focus on the key points, action items, or decisions mentioned.

From: ${email.from}
Date: ${email.date}
Subject: ${email.subject}
Body: ${email.body}`

  try {
    const response = await getAnthropicClient().messages.create({
      model: MODEL,
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
