/**
 * Rule-Based Loan Status Detection — replaces AI-powered detectAndUpdateLoanStatus().
 *
 * Phase 2 refactor: deterministic keyword matching + date extraction.
 * Loan status transitions are well-defined — no AI needed.
 */

import { getActiveConstructionLoan, updateLoanFields } from './loan-service'
import type { ConstructionLoan } from '@/types'

// ---------------------------------------------------------------------------
// Status hierarchy and validation
// ---------------------------------------------------------------------------

const STATUS_HIERARCHY: ConstructionLoan['application_status'][] = [
  'not_started', 'in_progress', 'submitted', 'under_review',
  'conditionally_approved', 'approved', 'funded',
]

function isStatusProgression(current: string, proposed: string): boolean {
  if (proposed === 'rejected' || proposed === 'withdrawn') return true
  const currentIdx = STATUS_HIERARCHY.indexOf(current as ConstructionLoan['application_status'])
  const proposedIdx = STATUS_HIERARCHY.indexOf(proposed as ConstructionLoan['application_status'])
  return proposedIdx > currentIdx
}

// ---------------------------------------------------------------------------
// Keyword patterns → status mapping
// ---------------------------------------------------------------------------

interface StatusPattern {
  pattern: RegExp
  status: ConstructionLoan['application_status']
  priority: number // higher = stronger signal
}

const STATUS_PATTERNS: StatusPattern[] = [
  // Terminal / strong signals first
  { pattern: /\b(loan|mortgage)\s+(has been\s+)?funded\b/i, status: 'funded', priority: 10 },
  { pattern: /\bfunding\s+(is\s+)?complete/i, status: 'funded', priority: 10 },
  { pattern: /\bwire\s+sent|funds?\s+disbursed/i, status: 'funded', priority: 9 },
  { pattern: /\b(denied|rejection|loan\s+denied|application\s+denied)\b/i, status: 'rejected', priority: 10 },
  { pattern: /\bwithdraw(n|ing)\s+(the\s+)?(loan|application)/i, status: 'withdrawn', priority: 10 },

  // Approved
  { pattern: /\b(fully|final(ly)?)\s+approved\b/i, status: 'approved', priority: 8 },
  { pattern: /\bclear\s+to\s+close\b/i, status: 'approved', priority: 8 },
  { pattern: /\bloan\s+(is\s+|has\s+been\s+)?approved\b/i, status: 'approved', priority: 7 },
  { pattern: /\bapproval\s+(letter|notice|confirm)/i, status: 'approved', priority: 7 },

  // Conditionally approved
  { pattern: /\bconditional(ly)?\s+approved\b/i, status: 'conditionally_approved', priority: 7 },
  { pattern: /\bapproved\s+with\s+conditions\b/i, status: 'conditionally_approved', priority: 7 },
  { pattern: /\bconditions?\s+(to\s+)?clear\b/i, status: 'conditionally_approved', priority: 6 },

  // Under review
  { pattern: /\b(in|under)\s+(active\s+)?review\b/i, status: 'under_review', priority: 5 },
  { pattern: /\bunderwriting\s+(is\s+)?(review|analyz)/i, status: 'under_review', priority: 5 },
  { pattern: /\bappraisal\s+(has\s+been\s+)?(order|schedul|complet)/i, status: 'under_review', priority: 4 },

  // Submitted
  { pattern: /\bsubmitted\s+to\s+underwriting\b/i, status: 'submitted', priority: 5 },
  { pattern: /\b(file|application|package)\s+(has\s+been\s+)?submitted\b/i, status: 'submitted', priority: 4 },
  { pattern: /\bsent\s+to\s+underwriting\b/i, status: 'submitted', priority: 4 },

  // In progress
  { pattern: /\b(started|beginning|initiating)\s+(the\s+)?(loan|application)\s+(process|application)\b/i, status: 'in_progress', priority: 3 },
  { pattern: /\bpre-?qual(ified|ification)\b/i, status: 'in_progress', priority: 3 },
]

// ---------------------------------------------------------------------------
// Date extraction
// ---------------------------------------------------------------------------

const DATE_PATTERNS = [
  // "closing date is April 15, 2026" / "closing scheduled for 04/15/2026"
  { field: 'closing_date' as const, pattern: /\bclosing\s+(?:date|scheduled|set)\s+(?:is|for)\s+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i },
  // "approved on March 20, 2026"
  { field: 'approval_date' as const, pattern: /\bapproved?\s+(?:on|date)\s+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i },
  // "funded on ..." / "funding date ..."
  { field: 'funding_date' as const, pattern: /\bfund(?:ed|ing)\s+(?:on|date)\s+(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i },
]

// ---------------------------------------------------------------------------
// Rate / amount extraction
// ---------------------------------------------------------------------------

const RATE_PATTERN = /\b(?:rate|interest)\s+(?:is|at|of|locked\s+at)\s+(\d+\.?\d*)\s*%/i
const AMOUNT_PATTERN = /\b(?:loan\s+amount|approved\s+for)\s+\$?([\d,]+(?:\.\d{2})?)\b/i

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

export interface RuleLoanDetectionResult {
  updated: boolean
  reason?: string
  detectedStatus?: string
  confidence: number
}

/** Parse a date string into YYYY-MM-DD format */
function parseDate(dateStr: string): string | null {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  } catch {
    return null
  }
}

/**
 * Scan emails for loan status changes using keyword rules.
 * Drop-in replacement for the AI-powered detectAndUpdateLoanStatus().
 */
export async function detectAndUpdateLoanStatusRuleBased(
  projectId: string,
  recentEmails: Array<{ from: string; subject: string; body: string; date: string }>
): Promise<RuleLoanDetectionResult> {
  const loan = await getActiveConstructionLoan(projectId)
  if (!loan) return { updated: false, confidence: 0 }

  // Filter to loan-related emails
  const loanContactEmails = [
    loan.loan_officer_email,
    loan.loan_contact_email,
  ].filter(Boolean).map(e => e!.toLowerCase())

  const lenderName = loan.lender_name.toLowerCase()

  const loanEmails = recentEmails.filter(email => {
    const from = email.from.toLowerCase()
    const subject = email.subject.toLowerCase()
    if (loanContactEmails.some(c => from.includes(c))) return true
    if (subject.includes(lenderName)) return true
    if (/\b(loan|mortgage|underwriting|appraisal|closing|approv|funded|denied)\b/i.test(subject)) return true
    return false
  })

  if (loanEmails.length === 0) return { updated: false, confidence: 0 }

  // Scan all loan emails for status signals
  let bestMatch: { status: ConstructionLoan['application_status']; priority: number; source: string } | null = null

  for (const email of loanEmails) {
    const text = `${email.subject}\n${email.body.substring(0, 1500)}`

    for (const sp of STATUS_PATTERNS) {
      if (sp.pattern.test(text)) {
        // Only keep highest priority match
        if (!bestMatch || sp.priority > bestMatch.priority) {
          bestMatch = {
            status: sp.status,
            priority: sp.priority,
            source: `"${email.subject}" from ${email.from}`,
          }
        }
      }
    }
  }

  if (!bestMatch) {
    return { updated: false, reason: 'No status keywords found in loan emails', confidence: 0 }
  }

  // Validate status progression
  if (!isStatusProgression(loan.application_status, bestMatch.status)) {
    return {
      updated: false,
      reason: `Would go backward: ${loan.application_status} → ${bestMatch.status}`,
      detectedStatus: bestMatch.status,
      confidence: bestMatch.priority / 10,
    }
  }

  // Build update fields
  const updateFields: Record<string, unknown> = {
    application_status: bestMatch.status,
  }

  // Extract dates and numbers from all loan emails
  const allText = loanEmails.map(e => `${e.subject}\n${e.body.substring(0, 1500)}`).join('\n')

  for (const dp of DATE_PATTERNS) {
    const match = allText.match(dp.pattern)
    if (match) {
      const parsed = parseDate(match[1])
      if (parsed) updateFields[dp.field] = parsed
    }
  }

  const rateMatch = allText.match(RATE_PATTERN)
  if (rateMatch) updateFields.interest_rate = parseFloat(rateMatch[1])

  const amountMatch = allText.match(AMOUNT_PATTERN)
  if (amountMatch) updateFields.loan_amount = parseFloat(amountMatch[1].replace(/,/g, ''))

  // Apply update
  const updated = await updateLoanFields(loan.id!, updateFields as Parameters<typeof updateLoanFields>[1])
  if (updated) {
    const reason = `${loan.application_status} → ${bestMatch.status} (detected from ${bestMatch.source})`
    console.log(`Loan status auto-updated (rule-based): ${reason}`)
    return { updated: true, reason, confidence: bestMatch.priority / 10 }
  }

  return { updated: false, reason: 'Database update failed', confidence: bestMatch.priority / 10 }
}
