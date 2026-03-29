/**
 * Domain Expert Agent Router
 *
 * Classifies incoming changes (files, emails, events) and routes
 * them to the appropriate domain agent for processing.
 *
 * Routing is rule-based (fast, deterministic, no AI cost).
 * The domain agents themselves may use AI for extraction/analysis.
 */

import type { AgentDomain, ChangeEvent, AgentResult, FileInventoryRecord } from '@/types'

// ─── File Path Classification ────────────────────────────────────────────────

/** Path patterns that indicate a domain.
 *  ORDER MATTERS: more specific patterns must come before broader ones.
 *  e.g., /Receipts/ must match before /Bids/ (which is a parent folder).
 */
const PATH_PATTERNS: Array<{ pattern: RegExp; domain: AgentDomain }> = [
  // Financial (specific folders inside Bids/ — must be checked BEFORE /Bids/)
  { pattern: /\/Receipts?\//i, domain: 'financial' },
  { pattern: /\/Final Budget\//i, domain: 'financial' },
  { pattern: /\/Invoices?\//i, domain: 'financial' },
  { pattern: /\/Expenses?\//i, domain: 'financial' },
  { pattern: /\/Financial\//i, domain: 'financial' },
  { pattern: /\/Budget\//i, domain: 'financial' },

  // Contracts (before Bids/ too, in case contracts live under Bids/)
  { pattern: /\/Contracts?\//i, domain: 'contract' },
  { pattern: /\/Agreements?\//i, domain: 'contract' },
  { pattern: /\/Legal\//i, domain: 'contract' },

  // Plan/drawing files → takeoff
  { pattern: /\/Plans?\//i, domain: 'takeoff' },
  { pattern: /\/Drawings?\//i, domain: 'takeoff' },
  { pattern: /\/Architectural\//i, domain: 'takeoff' },
  { pattern: /\/Structural\//i, domain: 'takeoff' },
  { pattern: /\/Engineering Plans?\//i, domain: 'takeoff' },

  // Bid-related folders (broad catch-all — after specific overrides)
  { pattern: /\/Bids\//i, domain: 'bid_analysis' },
  { pattern: /\/Quotes?\//i, domain: 'bid_analysis' },
  { pattern: /\/Estimates?\//i, domain: 'bid_analysis' },
  { pattern: /\/Proposals?\//i, domain: 'bid_analysis' },
]

/** Filename patterns */
const FILENAME_PATTERNS: Array<{ pattern: RegExp; domain: AgentDomain }> = [
  // Bid/quote documents (use looser matching — filenames use underscores/hyphens as separators)
  { pattern: /(^|[\s_\-.])(bid|quote|estimate|proposal)([\s_\-.]|$)/i, domain: 'bid_analysis' },
  { pattern: /(^|[\s_\-.])(pric(?:e|ing))([\s_\-.]|$)/i, domain: 'bid_analysis' },

  // Plans and drawings
  { pattern: /\b(floor.?plan|elevation|section|detail)\b/i, domain: 'takeoff' },
  { pattern: /\.(dxf|dwg)$/i, domain: 'takeoff' },

  // Financial
  { pattern: /(^|[\s_\-.])(invoice|receipt|payment|expense)([\s_\-.]|$)/i, domain: 'financial' },
  { pattern: /(^|[\s_\-.])(draw.?schedule|disbursement)([\s_\-.]|$)/i, domain: 'financial' },

  // Contracts
  { pattern: /\b(contract|agreement|scope.?of.?work|sow)\b/i, domain: 'contract' },
  { pattern: /\b(addendum|amendment|change.?order)\b/i, domain: 'contract' },
]

/**
 * Classify a file by its path and name into a domain.
 * Used during Dropbox scanning to pre-tag files before processing.
 */
export function classifyFileByPath(filePath: string, fileName: string): AgentDomain {
  // Check path patterns first (more specific)
  for (const { pattern, domain } of PATH_PATTERNS) {
    if (pattern.test(filePath)) return domain
  }

  // Then check filename patterns
  for (const { pattern, domain } of FILENAME_PATTERNS) {
    if (pattern.test(fileName)) return domain
  }

  return 'general'
}

// ─── Email Classification ────────────────────────────────────────────────────

/** Email subject/sender patterns.
 *  ORDER MATTERS: more specific patterns first. "Following up on our proposal"
 *  should match follow_up, not bid_analysis (despite containing "proposal").
 */
const EMAIL_PATTERNS: Array<{ pattern: RegExp; domain: AgentDomain }> = [
  // Vendor follow-up signals (before bid patterns — "following up on proposal" is a follow-up)
  { pattern: /\bfollow(?:ing)?.?up\b/i, domain: 'follow_up' },
  { pattern: /\b(checking.?in|status.?update|circling.?back)\b/i, domain: 'follow_up' },
  { pattern: /\b(response.?needed|waiting|overdue)\b/i, domain: 'follow_up' },

  // Bid-related
  { pattern: /\b(bid|quote|estimate|proposal|pricing)\b/i, domain: 'bid_analysis' },

  // Financial
  { pattern: /\b(invoice|payment|receipt|draw|disbursement)\b/i, domain: 'financial' },
  { pattern: /\b(loan|mortgage|closing|appraisal)\b/i, domain: 'financial' },

  // Scheduling
  { pattern: /\b(schedule|timeline|start.?date|completion|delay)\b/i, domain: 'scheduling' },
  { pattern: /\b(inspection|permit|approved|denied)\b/i, domain: 'scheduling' },

  // Contract
  { pattern: /\b(contract|agreement|sign|execute|amendment)\b/i, domain: 'contract' },
]

/**
 * Classify an email by subject and sender into a domain.
 */
export function classifyEmail(subject: string, senderEmail: string): AgentDomain {
  // Check subject patterns
  for (const { pattern, domain } of EMAIL_PATTERNS) {
    if (pattern.test(subject)) return domain
  }

  return 'general'
}

// ─── Agent Dispatch ──────────────────────────────────────────────────────────

/** Registry of domain agent handlers */
type AgentHandler = (events: ChangeEvent[], projectId: string) => Promise<AgentResult>

const agentHandlers = new Map<AgentDomain, AgentHandler>()

/**
 * Register a domain agent handler.
 * Called during module initialization by each agent.
 */
export function registerAgent(domain: AgentDomain, handler: AgentHandler): void {
  agentHandlers.set(domain, handler)
}

/**
 * Route change events to the appropriate domain agents.
 * Groups events by domain and dispatches to registered handlers.
 */
export async function dispatchToAgents(
  events: ChangeEvent[],
  projectId: string
): Promise<AgentResult[]> {
  // Group events by domain
  const byDomain = new Map<AgentDomain, ChangeEvent[]>()
  for (const event of events) {
    const existing = byDomain.get(event.domain) || []
    existing.push(event)
    byDomain.set(event.domain, existing)
  }

  const results: AgentResult[] = []

  // Dispatch to each domain's agent
  for (const [domain, domainEvents] of byDomain) {
    const handler = agentHandlers.get(domain)

    if (!handler) {
      // No handler registered — log and skip
      results.push({
        domain,
        source: domainEvents[0].source,
        action: 'skipped',
        details: `No agent registered for domain '${domain}'. ${domainEvents.length} event(s) queued.`,
        records_created: 0,
        records_updated: 0,
        errors: [],
        duration_ms: 0,
      })
      continue
    }

    const start = Date.now()
    try {
      const result = await handler(domainEvents, projectId)
      result.duration_ms = Date.now() - start
      results.push(result)
    } catch (error) {
      results.push({
        domain,
        source: domainEvents[0].source,
        action: 'failed',
        details: `Agent crashed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        records_created: 0,
        records_updated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration_ms: Date.now() - start,
      })
    }
  }

  return results
}

/**
 * Get a summary of which domains have pending work.
 */
export function summarizeEvents(events: ChangeEvent[]): Record<AgentDomain, number> {
  const summary: Partial<Record<AgentDomain, number>> = {}
  for (const event of events) {
    summary[event.domain] = (summary[event.domain] || 0) + 1
  }
  return summary as Record<AgentDomain, number>
}
