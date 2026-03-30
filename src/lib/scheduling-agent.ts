/**
 * Scheduling Agent
 *
 * Domain agent that processes schedule-related emails.
 * Detects inspection dates, permit approvals, delays, timeline updates,
 * and creates task records when actionable dates are found.
 *
 * Registered with the agent router for the 'scheduling' domain.
 */

import { registerAgent } from './agent-router'
import { supabase } from './supabase'
import type { ChangeEvent, AgentResult } from '@/types'

const MAX_PER_RUN = 20

interface ExtractedScheduleItem {
  type: 'inspection' | 'permit' | 'deadline' | 'milestone' | 'delay'
  title: string
  date?: string
  description?: string
  vendor_or_authority?: string
  impact?: string
}

/**
 * Use Claude to extract scheduling data from email content.
 */
async function extractScheduleData(
  subject: string,
  body: string,
  sender: string,
): Promise<ExtractedScheduleItem[]> {
  try {
    const { getAnthropicClient } = await import('./ai-clients')

    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract scheduling-relevant items from this email.

From: ${sender}
Subject: ${subject}

Body:
${body.slice(0, 3000)}

Return ONLY valid JSON array (no markdown, no code fences). Each item:
{
  "type": "inspection" | "permit" | "deadline" | "milestone" | "delay",
  "title": "brief description of the scheduled item",
  "date": "YYYY-MM-DD or null if no specific date mentioned",
  "description": "details about this item",
  "vendor_or_authority": "who is responsible or involved",
  "impact": "any schedule impact mentioned (e.g., '2 week delay')"
}

If no scheduling items found, return: []`,
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return []

    return JSON.parse(content.text) as ExtractedScheduleItem[]
  } catch (err) {
    console.error('Schedule extraction failed:', err)
    return []
  }
}

/**
 * Scheduling Agent handler.
 */
async function handleScheduling(events: ChangeEvent[], projectId: string): Promise<AgentResult> {
  const result: AgentResult = {
    domain: 'scheduling',
    source: 'gmail',
    action: 'process_schedule_emails',
    details: '',
    records_created: 0,
    records_updated: 0,
    errors: [],
    duration_ms: 0,
  }

  const emailEvents = events
    .filter(e => e.email_id)
    .slice(0, MAX_PER_RUN)

  if (emailEvents.length === 0) {
    result.details = 'No schedule-related emails to process'
    return result
  }

  for (const event of emailEvents) {
    try {
      // Fetch the full email content
      const { data: email } = await supabase
        .from('emails')
        .select('id, subject, sender_email, body, received_date')
        .eq('id', event.email_id!)
        .single()

      if (!email) continue

      const items = await extractScheduleData(
        email.subject || '',
        email.body || '',
        email.sender_email || '',
      )

      // Create tasks for items with dates
      for (const item of items) {
        if (!item.date && !item.title) continue

        const notes = [
              item.description,
              item.vendor_or_authority ? `Responsible: ${item.vendor_or_authority}` : null,
              item.impact ? `Impact: ${item.impact}` : null,
              `[intelligence-engine] From: ${email.sender_email} (${email.received_date})`,
            ].filter(Boolean).join('\n')

        const { error: taskError } = await supabase
          .from('tasks')
          .insert({
            project_id: projectId,
            title: item.title,
            due_date: item.date || null,
            status: 'pending',
            priority: item.type === 'delay' ? 'high' : item.type === 'inspection' ? 'medium' : 'low',
            notes,
          })

        if (taskError) {
          result.errors.push(`Task creation failed: ${taskError.message}`)
        } else {
          result.records_created++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      result.errors.push(msg)
    }
  }

  result.details = `Created ${result.records_created} task(s) from ${emailEvents.length} schedule email(s)`
  if (result.errors.length > 0) {
    result.details += `, ${result.errors.length} errors`
  }

  return result
}

registerAgent('scheduling', handleScheduling)
export { handleScheduling }
