import { NextRequest } from 'next/server'
import { getAnthropicClient, parseAIJsonResponse } from '@/lib/ai-clients'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'
import type { DraftEmail } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, toName, subjectHint, context } = body as {
      to?: string
      toName?: string
      subjectHint?: string
      context: string
    }

    if (!context) {
      return validationError('context is required')
    }

    const prompt = `You are an AI assistant helping a homeowner (Daniel Case, danielcase.info@gmail.com) manage a home construction project with UBuildIt.

Generate ONE email draft based on this action item:

Action: ${context}
${to ? `Recipient email: ${to}` : ''}
${toName ? `Recipient name: ${toName}` : ''}
${subjectHint ? `Suggested subject: ${subjectHint}` : ''}

Return a JSON object with:
{
  "to": "${to || 'recipient@email.com'}",
  "toName": "${toName || 'Recipient'}",
  "subject": "Clear subject line",
  "body": "<p>HTML formatted email body</p>",
  "reason": "Why this email should be sent",
  "priority": "high/medium/low"
}

Rules for the email body:
- Use HTML: <p> for paragraphs, <br> for line breaks, <b> for bold, <ul>/<li> for lists
- Professional but friendly tone
- Sign off as "Daniel Case" or "Daniel"
- Be specific and reference the action item context
- Keep the email concise and action-oriented

Return valid JSON only, no markdown fences or explanation.`

    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return errorResponse(new Error('No text response from AI'), 'Failed to generate draft')
    }

    const parsed = parseAIJsonResponse(content.text) as Omit<DraftEmail, 'id' | 'status'>

    const draft: DraftEmail = {
      ...parsed,
      id: `draft-${Date.now()}`,
      status: 'draft',
      relatedActionItem: context
    }

    return successResponse({ draft })
  } catch (error) {
    return errorResponse(error, 'Failed to generate draft email')
  }
}
