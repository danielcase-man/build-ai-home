/**
 * Rule-Based Email Classifier — replaces the AI-powered classifyAndSummarizeEmail().
 *
 * Phase 2 refactor: this deterministic classifier handles 95%+ of emails
 * without any API calls. Categories match the existing AI output:
 *   - 'construction': vendors, architects, engineers, UBuildIt, JobTread
 *   - 'financial': lenders, banks, title, appraisal
 *   - 'legal': insurance claims, attorneys, credit disputes
 *   - 'other': marketing, newsletters, shipping, notifications
 *
 * Claude Code can enhance classifications later via scheduled agents.
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Known sender patterns (static, high-confidence)
// ---------------------------------------------------------------------------

/** Domains that are ALWAYS construction-related */
const CONSTRUCTION_DOMAINS = new Set([
  'ubuildit.com',
  'kippflores.com',
  'asiri-designs.com',
  'jobtread.com',
  'beecavedrilling.com',
  'allandgroup.com',
  'doorwin.com',
  // Vendors/subs get added dynamically from contacts table
])

/** Domains that are ALWAYS financial */
const FINANCIAL_DOMAINS = new Set([
  'riverbearfinancial.com',
  'thefederalsavingsbank.com',
  'docusign.com',
  'docusign.net',
])

/** Domains that are ALWAYS legal */
const LEGAL_DOMAINS = new Set([
  'usaa.com',
  'penncredit.com',
])

/** Domains that are ALWAYS noise */
const NOISE_DOMAINS = new Set([
  'github.com',
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'google.com',
  'youtube.com',
  'stripe.com',
  'alpaca.markets',
  'vercel.com',
  'supabase.com',
  'anthropic.com',
  'noreply',
  'no-reply',
  'notifications',
  'marketing',
  'news',
  'newsletter',
  'digest',
  'updates',
  'info@',
  'support@',
])

// ---------------------------------------------------------------------------
// Subject keyword patterns
// ---------------------------------------------------------------------------

const CONSTRUCTION_KEYWORDS = /\b(bid|quote|estimate|invoice|framing|foundation|plumbing|hvac|electrical|roofing|cabinet|window|door|permit|inspection|grading|septic|well|drywall|insulation|tile|paint|flooring|concrete|lumber|sheathing|contractor|subcontractor|scope.of.work|change.order|punch.list|draw.request|job.?tread|ubuildit|purple.salvia|case.residence|liberty.hill)\b/i

const FINANCIAL_KEYWORDS = /\b(loan|mortgage|pre-?approv|approv|rate.lock|closing|title|appraisal|underwriting|pre-?qual|lender|bank|credit.report|fico|dti|ltv|construction.loan|draw.schedule|interest.rate|down.payment|earnest.money|escrow|hud|urla|1003)\b/i

const LEGAL_KEYWORDS = /\b(claim|attorney|lawyer|lawsuit|demand.letter|diminished.value|adjuster|settlement|dispute|complaint|cfpb|fdcpa|fcra|collections?|debt.collector|insurance.claim|policy.number)\b/i

const NOISE_KEYWORDS = /\b(unsubscribe|view.in.browser|email.preferences|opt.out|privacy.policy|terms.of.service|free.trial|limited.time|sale|discount|promo|coupon|shipping.confirm|tracking.number|delivery.update|order.confirm|receipt.for|your.subscription|your.account|password.reset|security.alert|two.factor|verify.your|sign.in|log.in)\b/i

// ---------------------------------------------------------------------------
// Core classifier
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  category: 'construction' | 'financial' | 'legal' | 'other'
  confidence: number  // 0-1, how confident the rule-based system is
  rule: string        // Which rule triggered (for debugging)
}

/** Classify an email by sender and subject — no AI needed */
export function classifyEmail(
  senderEmail: string,
  subject: string,
  bodyPreview: string,
  knownContactEmails?: Set<string>
): ClassificationResult {
  const email = senderEmail.toLowerCase()
  const domain = email.split('@')[1] || ''
  const text = `${subject} ${bodyPreview}`.toLowerCase()

  // 1. Check noise domains first (highest confidence reject)
  for (const noise of NOISE_DOMAINS) {
    if (domain.includes(noise) || email.includes(noise)) {
      return { category: 'other', confidence: 0.95, rule: `noise_domain:${noise}` }
    }
  }

  // 2. Check known construction domains
  if (CONSTRUCTION_DOMAINS.has(domain)) {
    return { category: 'construction', confidence: 0.99, rule: `construction_domain:${domain}` }
  }

  // 3. Check financial domains
  if (FINANCIAL_DOMAINS.has(domain)) {
    return { category: 'financial', confidence: 0.99, rule: `financial_domain:${domain}` }
  }

  // 4. Check legal domains
  if (LEGAL_DOMAINS.has(domain)) {
    return { category: 'legal', confidence: 0.99, rule: `legal_domain:${domain}` }
  }

  // 5. Check against dynamic contacts from database
  if (knownContactEmails?.has(email)) {
    return { category: 'construction', confidence: 0.90, rule: 'known_contact' }
  }

  // 6. Check noise keywords (before construction keywords — some marketing emails mention construction terms)
  if (NOISE_KEYWORDS.test(text) && !CONSTRUCTION_KEYWORDS.test(subject)) {
    return { category: 'other', confidence: 0.80, rule: 'noise_keywords' }
  }

  // 7. Check subject keywords (higher weight than body)
  if (CONSTRUCTION_KEYWORDS.test(subject)) {
    return { category: 'construction', confidence: 0.85, rule: 'construction_subject' }
  }

  if (FINANCIAL_KEYWORDS.test(subject)) {
    return { category: 'financial', confidence: 0.85, rule: 'financial_subject' }
  }

  if (LEGAL_KEYWORDS.test(subject)) {
    return { category: 'legal', confidence: 0.85, rule: 'legal_subject' }
  }

  // 8. Check body keywords (lower confidence)
  if (CONSTRUCTION_KEYWORDS.test(text)) {
    return { category: 'construction', confidence: 0.65, rule: 'construction_body' }
  }

  if (FINANCIAL_KEYWORDS.test(text)) {
    return { category: 'financial', confidence: 0.65, rule: 'financial_body' }
  }

  if (LEGAL_KEYWORDS.test(text)) {
    return { category: 'legal', confidence: 0.65, rule: 'legal_body' }
  }

  // 9. Default: other
  return { category: 'other', confidence: 0.50, rule: 'default' }
}

// ---------------------------------------------------------------------------
// Database-aware classifier (loads contacts for dynamic matching)
// ---------------------------------------------------------------------------

let _contactEmailCache: Set<string> | null = null
let _contactCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/** Load known contact emails from the database (cached) */
async function getKnownContactEmails(projectId: string): Promise<Set<string>> {
  const now = Date.now()
  if (_contactEmailCache && now - _contactCacheTime < CACHE_TTL) {
    return _contactEmailCache
  }

  const { data } = await supabase
    .from('contacts')
    .select('email')
    .eq('project_id', projectId)
    .not('email', 'is', null)

  const emails = new Set<string>()
  if (data) {
    for (const contact of data) {
      if (contact.email) {
        emails.add(contact.email.toLowerCase())
      }
    }
  }

  _contactEmailCache = emails
  _contactCacheTime = now
  return emails
}

/**
 * Classify and generate a basic summary — drop-in replacement for the AI version.
 * Returns the same { summary, category } shape as classifyAndSummarizeEmail().
 */
export async function classifyAndSummarizeEmailRuleBased(
  email: { from: string; subject: string; body: string; date: string },
  projectId: string
): Promise<{ summary: string; category: string; confidence: number; rule: string }> {
  const senderEmail = extractEmail(email.from)
  const contacts = await getKnownContactEmails(projectId)

  const result = classifyEmail(
    senderEmail,
    email.subject,
    email.body.substring(0, 500),
    contacts
  )

  // Generate a basic extractive summary (first meaningful sentence)
  const summary = result.category !== 'other'
    ? generateExtractSummary(email.subject, email.body)
    : ''

  return {
    summary,
    category: result.category,
    confidence: result.confidence,
    rule: result.rule,
  }
}

/** Extract email address from "Name <email>" format */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return (match ? match[1] : from).toLowerCase().trim()
}

/** Generate a simple extractive summary (no AI) */
function generateExtractSummary(subject: string, body: string): string {
  // Clean the body
  const cleaned = body
    .replace(/^(>.*$|On .* wrote:.*$)/gm, '') // Remove quoted text
    .replace(/\r?\n\s*\r?\n/g, '\n')          // Collapse blank lines
    .replace(/--\s*\n[\s\S]*$/, '')            // Remove signature
    .trim()

  // Take the first meaningful sentence (skip greetings)
  const lines = cleaned.split('\n').filter(l => l.trim().length > 10)
  const greetings = /^(hi|hello|hey|dear|good morning|good afternoon|good evening|thanks|thank you)/i

  for (const line of lines) {
    if (!greetings.test(line.trim())) {
      const sentence = line.trim().substring(0, 200)
      return sentence.endsWith('.') ? sentence : `${sentence}...`
    }
  }

  // Fallback: use the subject
  return subject
}
