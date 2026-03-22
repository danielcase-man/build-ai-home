import { getAnthropicClient, parseAIJsonResponse } from './ai-clients'
import { getActiveConstructionLoan, updateLoanFields } from './loan-service'
import type { ConstructionLoan } from '@/types'

interface LoanStatusUpdate {
  should_update: boolean
  new_status?: ConstructionLoan['application_status']
  updated_fields?: Partial<Pick<ConstructionLoan,
    'application_status' | 'approval_date' | 'funding_date' | 'closing_date' |
    'interest_rate' | 'loan_amount' | 'notes'
  >>
  reason?: string
}

const STATUS_HIERARCHY: ConstructionLoan['application_status'][] = [
  'not_started', 'in_progress', 'submitted', 'under_review',
  'conditionally_approved', 'approved', 'funded',
]

function isStatusProgression(current: string, proposed: string): boolean {
  // rejected/withdrawn can happen from any state
  if (proposed === 'rejected' || proposed === 'withdrawn') return true
  const currentIdx = STATUS_HIERARCHY.indexOf(current as ConstructionLoan['application_status'])
  const proposedIdx = STATUS_HIERARCHY.indexOf(proposed as ConstructionLoan['application_status'])
  return proposedIdx > currentIdx
}

/**
 * Scans recent emails for loan-related status changes and auto-updates the loan record.
 * Called during email sync, after emails are stored and project status is updated.
 */
export async function detectAndUpdateLoanStatus(
  projectId: string,
  recentEmails: Array<{ from: string; subject: string; body: string; date: string }>
): Promise<{ updated: boolean; reason?: string }> {
  const loan = await getActiveConstructionLoan(projectId)
  if (!loan) return { updated: false }

  // Filter emails that might be loan-related
  const loanContactEmails = [
    loan.loan_officer_email,
    loan.loan_contact_email,
  ].filter(Boolean).map(e => e!.toLowerCase())

  const lenderName = loan.lender_name.toLowerCase()

  const loanRelatedEmails = recentEmails.filter(email => {
    const fromLower = email.from.toLowerCase()
    const subjectLower = email.subject.toLowerCase()
    // From a loan contact
    if (loanContactEmails.some(contact => fromLower.includes(contact))) return true
    // Mentions lender name in subject
    if (subjectLower.includes(lenderName)) return true
    // Common loan keywords in subject
    if (/\b(loan|mortgage|underwriting|appraisal|closing|approval|pre-?approv|conditionally|funded|denied)\b/i.test(subjectLower)) return true
    return false
  })

  if (loanRelatedEmails.length === 0) return { updated: false }

  // Build prompt for AI to analyze
  const emailSummaries = loanRelatedEmails.map(e =>
    `FROM: ${e.from}\nDATE: ${e.date}\nSUBJECT: ${e.subject}\nBODY: ${e.body.substring(0, 800)}`
  ).join('\n---\n')

  const prompt = `You are analyzing emails related to a construction loan application.

CURRENT LOAN STATUS:
- Lender: ${loan.lender_name}
- Current Status: ${loan.application_status}
- Loan Amount: $${loan.loan_amount?.toLocaleString()}
- Loan Officer: ${loan.loan_officer_name || 'Unknown'}
- Application Date: ${loan.application_date || 'Unknown'}

RECENT EMAILS:
${emailSummaries}

Based on these emails, determine if the loan application status should be updated.

Valid statuses in order: not_started → in_progress → submitted → under_review → conditionally_approved → approved → funded
Terminal statuses: rejected, withdrawn

RULES:
- Only recommend a status change if the email CLEARLY indicates a status progression
- Look for explicit language: "approved", "conditionally approved", "funded", "denied", "rejected", "under review", "submitted to underwriting", etc.
- Extract any mentioned dates (approval date, closing date, funding date)
- Extract any updated loan terms (rate changes, amount changes)
- If no clear status change is indicated, set should_update to false
- Do NOT recommend going backward in status (e.g., from submitted to in_progress)
- Be conservative — only update on clear evidence

Respond with JSON only:
{
  "should_update": boolean,
  "new_status": "status_value" | null,
  "updated_fields": {
    "application_status": "new_status" (only if changed),
    "approval_date": "YYYY-MM-DD" (only if mentioned),
    "funding_date": "YYYY-MM-DD" (only if mentioned),
    "closing_date": "YYYY-MM-DD" (only if mentioned),
    "interest_rate": number (only if changed),
    "loan_amount": number (only if changed)
  },
  "reason": "Brief explanation of why status should/shouldn't change"
}`

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      temperature: 0,
      system: 'You are a loan status analyst. Respond with valid JSON only. Be conservative — only recommend changes with clear evidence.',
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') return { updated: false }

    const result = parseAIJsonResponse(content.text) as LoanStatusUpdate

    if (!result.should_update || !result.updated_fields) {
      console.log(`Loan status detection: no update needed — ${result.reason}`)
      return { updated: false, reason: result.reason }
    }

    // Validate status progression
    if (result.updated_fields.application_status) {
      if (!isStatusProgression(loan.application_status, result.updated_fields.application_status)) {
        console.log(`Loan status detection: rejected backward progression ${loan.application_status} → ${result.updated_fields.application_status}`)
        return { updated: false, reason: 'Status would go backward' }
      }
    }

    // Apply the update
    const updated = await updateLoanFields(loan.id!, result.updated_fields)
    if (updated) {
      console.log(`Loan status auto-updated: ${loan.application_status} → ${result.updated_fields.application_status || 'fields only'} — ${result.reason}`)
      return { updated: true, reason: result.reason }
    }

    return { updated: false, reason: 'Database update failed' }
  } catch (error) {
    console.error('Loan status detection failed (non-fatal):', error)
    return { updated: false }
  }
}
