/**
 * Follow-Up Agent
 *
 * Domain agent that processes follow-up related emails.
 * Detects vendor communication gaps, follow-up needs,
 * and creates/updates vendor_follow_ups records.
 *
 * Registered with the agent router for the 'follow_up' domain.
 */

import { registerAgent } from './agent-router'
import { supabase } from './supabase'
import type { ChangeEvent, AgentResult, FollowUpStatus, FollowUpCategory } from '@/types'

const MAX_PER_RUN = 20

interface ExtractedFollowUp {
  vendor_name: string
  contact_email?: string
  category: string
  subject: string
  context?: string
  response_summary?: string
  needs_action: boolean
  suggested_next_date?: string
}

/**
 * Use Claude to extract follow-up data from email content.
 */
async function extractFollowUpData(
  subject: string,
  body: string,
  sender: string,
): Promise<ExtractedFollowUp | null> {
  try {
    const { getAnthropicClient } = await import('./ai-clients')

    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this email for vendor follow-up tracking.

From: ${sender}
Subject: ${subject}

Body:
${body.slice(0, 3000)}

Determine if this email is about following up with a vendor, checking in on a bid/quote,
or tracking communication with a contractor/supplier.

Return ONLY valid JSON (no markdown, no code fences):
{
  "vendor_name": "vendor or company name being followed up with",
  "contact_email": "${sender}" or the relevant contact email,
  "category": "bid_request" | "quote_follow_up" | "schedule_check" | "general_inquiry" | "escalation",
  "subject": "brief description of what's being followed up on",
  "context": "relevant context from the email",
  "response_summary": "if this IS a response, summarize it; null otherwise",
  "needs_action": true/false - does the owner need to take action?,
  "suggested_next_date": "YYYY-MM-DD or null - when to follow up next"
}

If this email is NOT about vendor follow-up, return: null`,
      }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return null

    const text = content.text.trim()
    if (text === 'null') return null
    return JSON.parse(text) as ExtractedFollowUp
  } catch (err) {
    console.error('Follow-up extraction failed:', err)
    return null
  }
}

/**
 * Map extracted category to our FollowUpCategory type.
 */
function mapCategory(extracted: string): FollowUpCategory {
  const map: Record<string, FollowUpCategory> = {
    bid_request: 'bid_request',
    quote_follow_up: 'bid_follow_up',
    schedule_check: 'scheduling',
    general_inquiry: 'general',
    escalation: 'bid_request',
  }
  return map[extracted] || 'general'
}

/**
 * Follow-Up Agent handler.
 */
async function handleFollowUp(events: ChangeEvent[], projectId: string): Promise<AgentResult> {
  const result: AgentResult = {
    domain: 'follow_up',
    source: 'gmail',
    action: 'process_follow_ups',
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
    result.details = 'No follow-up emails to process'
    return result
  }

  for (const event of emailEvents) {
    try {
      // Fetch the full email
      const { data: email } = await supabase
        .from('emails')
        .select('id, subject, sender_email, body, received_date')
        .eq('id', event.email_id!)
        .single()

      if (!email) continue

      const extracted = await extractFollowUpData(
        email.subject || '',
        email.body || '',
        email.sender_email || '',
      )

      if (!extracted) continue

      // Check for existing follow-up record for this vendor
      const { data: existingFollowUps } = await supabase
        .from('vendor_follow_ups')
        .select('id, follow_up_count, status')
        .eq('project_id', projectId)
        .ilike('vendor_name', `%${extracted.vendor_name}%`)
        .in('status', ['pending', 'sent', 'awaiting_response', 'follow_up_sent', 'stale'])
        .order('created_at', { ascending: false })
        .limit(1)

      const today = new Date().toISOString().slice(0, 10)
      const nextDate = extracted.suggested_next_date ||
        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

      if (existingFollowUps && existingFollowUps.length > 0) {
        // Update existing follow-up
        const existing = existingFollowUps[0]
        const newStatus: FollowUpStatus = extracted.response_summary
          ? 'responded'
          : existing.status as FollowUpStatus

        const { error: updateError } = await supabase
          .from('vendor_follow_ups')
          .update({
            last_contact_date: today,
            last_contact_method: 'email',
            response_summary: extracted.response_summary || undefined,
            status: newStatus,
            follow_up_count: (existing.follow_up_count || 0) + 1,
            next_follow_up_date: extracted.response_summary ? undefined : nextDate,
            notes: extracted.context,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (updateError) {
          result.errors.push(`Update failed for ${extracted.vendor_name}: ${updateError.message}`)
        } else {
          result.records_updated++
        }
      } else if (extracted.needs_action) {
        // Create new follow-up record
        const { error: insertError } = await supabase
          .from('vendor_follow_ups')
          .insert({
            project_id: projectId,
            vendor_name: extracted.vendor_name,
            contact_email: extracted.contact_email,
            category: mapCategory(extracted.category),
            subject: extracted.subject,
            context: extracted.context,
            created_date: today,
            initial_outreach_date: today,
            next_follow_up_date: nextDate,
            status: 'pending' as FollowUpStatus,
            follow_up_count: 0,
            max_follow_ups: 5,
            auto_send: false,
            last_contact_date: today,
            last_contact_method: 'email',
          })

        if (insertError) {
          result.errors.push(`Insert failed for ${extracted.vendor_name}: ${insertError.message}`)
        } else {
          result.records_created++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      result.errors.push(msg)
    }
  }

  result.details = [
    result.records_created > 0 ? `${result.records_created} new follow-up(s)` : null,
    result.records_updated > 0 ? `${result.records_updated} updated` : null,
    result.errors.length > 0 ? `${result.errors.length} errors` : null,
  ].filter(Boolean).join(', ') || 'No actionable follow-ups'

  return result
}

registerAgent('follow_up', handleFollowUp)
export { handleFollowUp }
