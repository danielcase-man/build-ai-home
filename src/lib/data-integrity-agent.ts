/**
 * Data Integrity Agent — declarative rules engine for FrameWork.
 *
 * Loads project data into an IntegrityContext, evaluates every registered rule,
 * auto-fixes safe issues, flags ambiguous ones, persists results, and returns
 * an integrity score (0-100).
 */

import { supabase } from './supabase'
import { normalizeVendorName, areLikelyDuplicateVendors } from './vendor-name-utils'
import { generateProjectStatusFromData } from './project-status-generator'
import { getFullProjectContext } from './project-service'
import type {
  IntegrityRule,
  IntegrityIssue,
  IntegrityContext,
  IntegrityRunResult,
  IntegrityTrigger,
  IntegritySeverity,
  IntegrityCategory,
} from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function issue(
  ctx: IntegrityContext,
  rule: { id: string; name: string; severity: IntegritySeverity; category: IntegrityCategory; autoFixable: boolean },
  desc: string,
  extra?: Partial<IntegrityIssue>,
): IntegrityIssue {
  return {
    project_id: ctx.projectId,
    rule_id: rule.id,
    rule_name: rule.name,
    severity: rule.severity,
    category: rule.category,
    description: desc,
    auto_fixable: rule.autoFixable,
    fix_applied: false,
    resolution_status: 'open',
    ...extra,
  }
}

function daysBetween(a: string | Date, b: string | Date): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
}

function minutesBetween(a: string | Date, b: string | Date): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60)
}

function pickCanonicalName(names: string[]): string {
  // Prefer names without parentheticals, then shorter names
  return names.sort((a, b) => {
    const aParens = (a.match(/\(/g) || []).length
    const bParens = (b.match(/\(/g) || []).length
    if (aParens !== bParens) return aParens - bParens
    return a.length - b.length
  })[0]
}

// ---------------------------------------------------------------------------
// Context Loader
// ---------------------------------------------------------------------------

async function loadIntegrityContext(projectId: string): Promise<IntegrityContext> {
  const [
    projectRes,
    budgetRes,
    bidsRes,
    lineItemsRes,
    tasksRes,
    milestonesRes,
    vendorsRes,
    selectionsRes,
    permitsRes,
    statusRes,
    aliasRes,
  ] = await Promise.all([
    supabase.from('projects').select('id, budget_total, square_footage, updated_at, phase, current_step').eq('id', projectId).single(),
    supabase.from('budget_items').select('id, category, estimated_cost, actual_cost, source, description').eq('project_id', projectId),
    supabase.from('bids').select('id, vendor_name, category, total_amount, status, created_at, ai_extracted, needs_review, source, valid_until, received_date, vendor_id').eq('project_id', projectId),
    supabase.from('bid_line_items').select('id, bid_id, total_price'),
    supabase.from('tasks').select('id, title, status, due_date, priority, notes, created_at').eq('project_id', projectId),
    supabase.from('milestones').select('id, name, status, target_date').eq('project_id', projectId),
    supabase.from('vendors').select('id, company_name, category, status').eq('project_id', projectId),
    supabase.from('selections').select('id, category, status, bid_id').eq('project_id', projectId),
    supabase.from('permits').select('id, type, status').eq('project_id', projectId),
    supabase.from('project_status').select('id, date, ai_summary, last_updated').eq('project_id', projectId).order('date', { ascending: false }).limit(3),
    supabase.from('vendor_aliases').select('canonical_name, alias'),
  ])

  return {
    projectId,
    project: projectRes.data ?? { id: projectId, budget_total: 0, square_footage: 0, updated_at: new Date().toISOString(), phase: 'unknown', current_step: 0 },
    budgetItems: budgetRes.data ?? [],
    bids: bidsRes.data ?? [],
    bidLineItems: lineItemsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    milestones: milestonesRes.data ?? [],
    vendors: vendorsRes.data ?? [],
    selections: selectionsRes.data ?? [],
    permits: permitsRes.data ?? [],
    statusRows: statusRes.data ?? [],
    vendorAliases: aliasRes.data ?? [],
  }
}

// ---------------------------------------------------------------------------
// Score Calculation
// ---------------------------------------------------------------------------

function calculateIntegrityScore(issues: IntegrityIssue[]): { score: number; breakdown: Record<string, number> } {
  const openIssues = issues.filter(i => i.resolution_status === 'open')
  const penalties: Record<IntegritySeverity, number> = { critical: 15, high: 8, medium: 3, low: 1 }
  const maxPenalties: Record<IntegritySeverity, number> = { critical: 45, high: 32, medium: 15, low: 8 }

  const severityPenalty: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const iss of openIssues) {
    severityPenalty[iss.severity] = Math.min(
      severityPenalty[iss.severity] + penalties[iss.severity],
      maxPenalties[iss.severity],
    )
  }
  const totalPenalty = Object.values(severityPenalty).reduce((a, b) => a + b, 0)
  const score = Math.max(0, 100 - totalPenalty)

  const categories = [...new Set(issues.map(i => i.category))]
  const breakdown: Record<string, number> = {}
  for (const cat of categories) {
    const catIssues = openIssues.filter(i => i.category === cat)
    const catPenalty = catIssues.reduce((sum, i) => sum + penalties[i.severity], 0)
    breakdown[cat] = Math.max(0, 100 - catPenalty)
  }

  return { score, breakdown }
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const RULES: IntegrityRule[] = [
  // ---- BUDGET ----
  {
    id: 'BUD-001', name: 'Budget Total Mismatch', severity: 'critical', category: 'budget', autoFixable: true,
    async check(ctx) {
      const itemsSum = ctx.budgetItems.reduce((s, b) => s + (b.estimated_cost > 0 ? b.estimated_cost : 0), 0)
      const delta = Math.abs(ctx.project.budget_total - itemsSum)
      if (delta > 1000) {
        return [issue(ctx, this, `Budget total ($${ctx.project.budget_total.toLocaleString()}) differs from sum of items ($${itemsSum.toLocaleString()}) by $${delta.toLocaleString()}`, {
          metadata: { project_total: ctx.project.budget_total, items_sum: itemsSum, delta },
        })]
      }
      return []
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { items_sum: number } | undefined
        if (!meta) return { fixed: false, description: 'No metadata' }
        await supabase.from('projects').update({ budget_total: meta.items_sum }).eq('id', iss.project_id)
        return { fixed: true, description: `Updated budget total to $${meta.items_sum.toLocaleString()} (sum of line items)` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'BUD-002', name: 'Zero-Cost Uncategorized Items', severity: 'medium', category: 'budget', autoFixable: false,
    async check(ctx) {
      const items = ctx.budgetItems.filter(b => b.estimated_cost === 0 && b.source === 'jobtread' && b.category === 'Uncategorized')
      if (items.length > 10) {
        return [issue(ctx, this, `${items.length} zero-cost uncategorized items from JobTread`, {
          metadata: { count: items.length },
          entity_ids: items.map(i => i.id),
        })]
      }
      return []
    },
  },
  {
    id: 'BUD-003', name: 'Budget Items Without Category', severity: 'low', category: 'budget', autoFixable: false,
    async check(ctx) {
      const items = ctx.budgetItems.filter(b => !b.category || b.category.trim() === '')
      if (items.length === 0) return []
      return [issue(ctx, this, `${items.length} budget item(s) missing a category`, {
        entity_ids: items.map(i => i.id),
        metadata: { count: items.length },
      })]
    },
  },
  {
    id: 'BUD-004', name: 'Duplicate Budget Items', severity: 'medium', category: 'budget', autoFixable: false,
    async check(ctx) {
      const nonJT = ctx.budgetItems.filter(b => b.source !== 'jobtread')
      const groups = new Map<string, typeof nonJT>()
      for (const b of nonJT) {
        const key = `${(b.category || '').toLowerCase()}|${(b.description || '').toLowerCase()}|${b.estimated_cost}`
        const list = groups.get(key) || []
        list.push(b)
        groups.set(key, list)
      }
      const issues: IntegrityIssue[] = []
      for (const [, group] of groups) {
        if (group.length > 1) {
          issues.push(issue(ctx, this, `${group.length} duplicate budget items: "${group[0].category} — ${group[0].description}" ($${group[0].estimated_cost})`, {
            entity_ids: group.map(g => g.id),
            metadata: { category: group[0].category, description: group[0].description, estimated_cost: group[0].estimated_cost, count: group.length },
          }))
        }
      }
      return issues
    },
  },

  // ---- BIDS ----
  {
    id: 'BID-001', name: 'Fragmented Bids', severity: 'critical', category: 'bids', autoFixable: true,
    async check(ctx) {
      const byCategory = new Map<string, typeof ctx.bids>()
      for (const b of ctx.bids) {
        const cat = (b.category || 'unknown').toLowerCase()
        const list = byCategory.get(cat) || []
        list.push(b)
        byCategory.set(cat, list)
      }

      const issues: IntegrityIssue[] = []
      for (const [, bids] of byCategory) {
        if (bids.length < 3) continue
        // Find clusters of likely-same vendor within 10 minutes
        const visited = new Set<string>()
        for (let i = 0; i < bids.length; i++) {
          if (visited.has(bids[i].id)) continue
          const cluster = [bids[i]]
          for (let j = i + 1; j < bids.length; j++) {
            if (visited.has(bids[j].id)) continue
            const nameMatch = areLikelyDuplicateVendors(bids[i].vendor_name, bids[j].vendor_name)
            const timeClose = minutesBetween(bids[i].created_at, bids[j].created_at) <= 10
            if (nameMatch && timeClose) {
              cluster.push(bids[j])
            }
          }
          if (cluster.length >= 3) {
            for (const c of cluster) visited.add(c.id)
            const names = cluster.map(c => c.vendor_name)
            const canonical = normalizeVendorName(names[0])
            issues.push(issue(ctx, this, `${cluster.length} fragmented bids from "${names[0]}" in ${bids[0].category}`, {
              entity_ids: cluster.map(c => c.id),
              metadata: {
                cluster_vendor_names: names,
                cluster_bid_ids: cluster.map(c => c.id),
                cluster_total: cluster.reduce((s, c) => s + c.total_amount, 0),
                recommended_canonical_name: canonical,
              },
            }))
          }
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { cluster_bid_ids: string[]; cluster_total: number } | undefined
        if (!meta?.cluster_bid_ids?.length) return { fixed: false, description: 'No metadata or cluster_bid_ids' }

        // Find the parent bid (highest total_amount in the cluster)
        const { data: clusterBids } = await supabase.from('bids')
          .select('id, total_amount, vendor_name')
          .in('id', meta.cluster_bid_ids)
          .order('total_amount', { ascending: false })
        if (!clusterBids?.length) return { fixed: false, description: 'Could not load cluster bids' }

        const parentBid = clusterBids[0]
        const fragmentIds = clusterBids.slice(1).map(b => b.id)

        // Mark fragments as superseded
        await supabase.from('bids').update({
          status: 'superseded',
          selection_notes: `[auto-consolidated: merged into bid ${parentBid.id}]`,
        }).in('id', fragmentIds)

        // Move line items from fragments to parent
        await supabase.from('bid_line_items').update({ bid_id: parentBid.id }).in('bid_id', fragmentIds)

        // Update parent total to cluster total
        await supabase.from('bids').update({ total_amount: meta.cluster_total }).eq('id', parentBid.id)

        return { fixed: true, description: `Consolidated ${fragmentIds.length} fragment(s) into parent bid ${parentBid.id} ("${parentBid.vendor_name}"), total $${meta.cluster_total.toLocaleString()}` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'BID-002', name: 'Missing Bids from JobTread', severity: 'high', category: 'bids', autoFixable: false,
    async check(ctx) {
      const jtItems = ctx.budgetItems.filter(b => b.source === 'jobtread' && b.category !== 'Uncategorized' && b.estimated_cost > 1000)
      const bidCategories = ctx.bids.map(b => (b.category || '').toLowerCase())
      const issues: IntegrityIssue[] = []
      for (const item of jtItems) {
        const catLower = (item.category || '').toLowerCase()
        const hasBid = bidCategories.some(bc => bc.includes(catLower) || catLower.includes(bc))
        if (!hasBid) {
          issues.push(issue(ctx, this, `No bids found for JobTread category "${item.category}" ($${item.estimated_cost.toLocaleString()})`, {
            entity_id: item.id,
            entity_type: 'budget_item',
            metadata: { jobtread_category: item.category, jobtread_amount: item.estimated_cost, jobtread_description: item.description },
          }))
        }
      }
      return issues
    },
  },
  {
    id: 'BID-003', name: 'Bids Without Vendor Record', severity: 'medium', category: 'bids', autoFixable: true,
    async check(ctx) {
      const issues: IntegrityIssue[] = []
      for (const bid of ctx.bids) {
        if (bid.vendor_id) continue
        const matchesVendor = ctx.vendors.some(v => v.company_name.toLowerCase() === bid.vendor_name.toLowerCase())
        if (!matchesVendor) {
          issues.push(issue(ctx, this, `Bid from "${bid.vendor_name}" has no matching vendor record`, {
            entity_id: bid.id,
            entity_type: 'bid',
            metadata: { vendor_name: bid.vendor_name, category: bid.category },
          }))
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { vendor_name: string; category: string } | undefined
        if (!meta) return { fixed: false, description: 'No metadata' }
        // Check if vendor exists first (may have been created by VND-001 or earlier in this run)
        const { data: existingVendor } = await supabase.from('vendors')
          .select('id').eq('project_id', iss.project_id)
          .ilike('company_name', meta.vendor_name).limit(1)
        let vendorId: string | null = existingVendor?.[0]?.id ?? null
        if (!vendorId) {
          const { data: vendor } = await supabase.from('vendors').insert({
            project_id: iss.project_id,
            company_name: meta.vendor_name,
            category: meta.category || 'General',
            status: 'potential',
          }).select('id').single()
          vendorId = vendor?.id ?? null
        }
        if (vendorId) {
          await supabase.from('bids').update({ vendor_id: vendorId }).eq('id', iss.entity_id)
          return { fixed: true, description: `Linked bid to vendor "${meta.vendor_name}"` }
        }
        return { fixed: false, description: 'Failed to find or create vendor' }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'BID-004', name: 'Bid Total vs Line Items Mismatch', severity: 'medium', category: 'bids', autoFixable: true,
    async check(ctx) {
      const issues: IntegrityIssue[] = []
      const lineItemsByBid = new Map<string, number>()
      for (const li of ctx.bidLineItems) {
        lineItemsByBid.set(li.bid_id, (lineItemsByBid.get(li.bid_id) || 0) + li.total_price)
      }
      for (const bid of ctx.bids) {
        const liSum = lineItemsByBid.get(bid.id)
        if (liSum === undefined || bid.total_amount <= 0) continue
        const variance = Math.abs(bid.total_amount - liSum)
        const variancePct = (variance / bid.total_amount) * 100
        if (variancePct > 5) {
          issues.push(issue(ctx, this, `Bid from "${bid.vendor_name}": total ($${bid.total_amount.toLocaleString()}) differs from line items ($${liSum.toLocaleString()}) by ${variancePct.toFixed(1)}%`, {
            entity_id: bid.id,
            entity_type: 'bid',
            metadata: { bid_id: bid.id, vendor_name: bid.vendor_name, bid_total: bid.total_amount, line_items_sum: liSum, variance_pct: Math.round(variancePct * 10) / 10 },
          }))
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { bid_id: string; line_items_sum: number; vendor_name: string } | undefined
        if (!meta) return { fixed: false, description: 'No metadata' }
        await supabase.from('bids').update({ total_amount: meta.line_items_sum }).eq('id', meta.bid_id)
        return { fixed: true, description: `Updated bid total for "${meta.vendor_name}" to $${meta.line_items_sum.toLocaleString()} (sum of line items)` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'BID-005', name: 'Expired Bids Still Pending', severity: 'low', category: 'bids', autoFixable: true,
    async check(ctx) {
      const today = new Date().toISOString().slice(0, 10)
      const expired = ctx.bids.filter(b => b.valid_until && b.valid_until < today && ['pending', 'under_review'].includes(b.status))
      return expired.map(b => issue(ctx, this, `Bid from "${b.vendor_name}" expired on ${b.valid_until} but still has status "${b.status}"`, {
        entity_id: b.id,
        entity_type: 'bid',
        metadata: { vendor_name: b.vendor_name, valid_until: b.valid_until, status: b.status },
      }))
    },
    async fix(iss) {
      try {
        await supabase.from('bids').update({ status: 'expired' }).eq('id', iss.entity_id)
        return { fixed: true, description: `Set bid status to "expired"` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'BID-006', name: 'Duplicate Vendor Names', severity: 'high', category: 'bids', autoFixable: true,
    async check(ctx) {
      const vendorNames = [...new Set(ctx.bids.map(b => b.vendor_name).filter(Boolean))]
      // Group by first 3 chars of normalized name to avoid O(n^2)
      const buckets = new Map<string, string[]>()
      for (const name of vendorNames) {
        const norm = normalizeVendorName(name)
        const key = norm.slice(0, 3)
        const list = buckets.get(key) || []
        list.push(name)
        buckets.set(key, list)
      }

      const issues: IntegrityIssue[] = []
      const reported = new Set<string>()
      for (const [, bucket] of buckets) {
        if (bucket.length < 2) continue
        for (let i = 0; i < bucket.length; i++) {
          for (let j = i + 1; j < bucket.length; j++) {
            if (areLikelyDuplicateVendors(bucket[i], bucket[j])) {
              const clusterKey = [bucket[i], bucket[j]].sort().join('|')
              if (reported.has(clusterKey)) continue
              reported.add(clusterKey)
              const bidIds = ctx.bids.filter(b => b.vendor_name === bucket[i] || b.vendor_name === bucket[j]).map(b => b.id)
              issues.push(issue(ctx, this, `Likely duplicate vendor names: "${bucket[i]}" and "${bucket[j]}"`, {
                entity_ids: bidIds,
                metadata: { vendor_names: [bucket[i], bucket[j]], normalized_names: [normalizeVendorName(bucket[i]), normalizeVendorName(bucket[j])] },
              }))
            }
          }
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { vendor_names: string[] } | undefined
        if (!meta?.vendor_names?.length) return { fixed: false, description: 'No metadata or vendor_names' }
        const bidIds = iss.entity_ids || []
        if (bidIds.length === 0) return { fixed: false, description: 'No bid IDs to update' }
        const canonicalName = pickCanonicalName([...meta.vendor_names])
        await supabase.from('bids').update({ vendor_name: canonicalName }).in('id', bidIds)
        return { fixed: true, description: `Normalized ${bidIds.length} bid(s) to vendor name "${canonicalName}"` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },

  // ---- TASKS ----
  {
    id: 'TSK-001', name: 'Tasks with Dates in Title but Null due_date', severity: 'high', category: 'tasks', autoFixable: true,
    async check(ctx) {
      const datePatterns = [
        /\b(?:due|by|deadline:?)\s*(20\d{2}[-/]\d{1,2}[-/]\d{1,2})/i,
        /\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/,
      ]
      const issues: IntegrityIssue[] = []
      for (const task of ctx.tasks) {
        if (task.due_date) continue
        for (const pattern of datePatterns) {
          const match = task.title.match(pattern)
          if (match) {
            const dateStr = match[1].replace(/\//g, '-')
            const parsed = new Date(dateStr)
            if (!isNaN(parsed.getTime())) {
              issues.push(issue(ctx, this, `Task "${task.title}" contains date ${dateStr} but has no due_date`, {
                entity_id: task.id,
                entity_type: 'task',
                metadata: { parsed_date: dateStr, title: task.title },
              }))
              break
            }
          }
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { parsed_date: string } | undefined
        if (!meta?.parsed_date) return { fixed: false, description: 'No parsed date' }
        await supabase.from('tasks').update({ due_date: meta.parsed_date }).eq('id', iss.entity_id)
        return { fixed: true, description: `Set due_date to ${meta.parsed_date}` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'TSK-002', name: 'Duplicate-Intent Tasks', severity: 'high', category: 'tasks', autoFixable: true,
    async check(ctx) {
      const active = ctx.tasks.filter(t => ['pending', 'in_progress'].includes(t.status))

      function normalizeIntent(title: string): string {
        let t = title
        t = t.replace(/\$[\d,]+(\.\d{2})?/g, '')
        t = t.replace(/\([^)]*\)/g, '')
        t = t.replace(/\b(available|under review|per unit|pending|in progress|needed|required|due\s+\d{4}[-/]\d+[-/]\d+)\b/gi, '')
        return t.toLowerCase().replace(/\s+/g, ' ').trim()
      }

      const groups = new Map<string, typeof active>()
      for (const task of active) {
        const key = normalizeIntent(task.title)
        if (!key) continue
        const list = groups.get(key) || []
        list.push(task)
        groups.set(key, list)
      }

      const issues: IntegrityIssue[] = []
      for (const [intent, group] of groups) {
        if (group.length < 2) continue
        // Sort by created_at descending — newest first, flag older ones
        const sorted = [...group].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const newestId = sorted[0].id
        for (const older of sorted.slice(1)) {
          issues.push(issue(ctx, this, `Duplicate task: "${older.title}" superseded by newer task`, {
            entity_id: older.id,
            entity_type: 'task',
            metadata: { normalized_intent: intent, superseded_by: newestId, title: older.title },
          }))
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const existingNotes = (iss.metadata as Record<string, unknown>)?.notes as string || ''
        const newNotes = existingNotes
          ? `${existingNotes}\n[auto-closed: superseded by newer task]`
          : '[auto-closed: superseded by newer task]'
        await supabase.from('tasks').update({ status: 'cancelled', notes: newNotes }).eq('id', iss.entity_id)
        return { fixed: true, description: 'Set task status to cancelled (superseded)' }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'TSK-003', name: 'Stale AI Tasks', severity: 'low', category: 'tasks', autoFixable: true,
    async check(ctx) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const aiPatterns = /^(Select vendor for|ORDER:|Get |Submit |Hire |Obtain )/i
      const stale = ctx.tasks.filter(t =>
        t.status === 'pending' &&
        new Date(t.created_at) < thirtyDaysAgo &&
        aiPatterns.test(t.title),
      )
      return stale.map(t => issue(ctx, this, `Stale AI task (30+ days pending): "${t.title}"`, {
        entity_id: t.id,
        entity_type: 'task',
        metadata: { title: t.title, created_at: t.created_at },
      }))
    },
    async fix(iss) {
      try {
        await supabase.from('tasks').update({
          status: 'cancelled',
          notes: ((iss.metadata as Record<string, unknown>)?.existing_notes as string || '') + '\n[auto-closed: stale pending task, 30+ days]',
        }).eq('id', iss.entity_id)
        return { fixed: true, description: 'Set stale AI task to cancelled' }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'TSK-004', name: 'Tasks Referencing Non-Existent Entities', severity: 'low', category: 'tasks', autoFixable: false,
    async check() {
      // Requires NLP parsing of task titles — skipped for now
      return []
    },
  },

  // ---- MILESTONES ----
  {
    id: 'MIL-001', name: 'Impossible Milestone Ordering', severity: 'critical', category: 'milestones', autoFixable: true,
    async check(ctx) {
      const ordering = [
        'Design Finalization', 'Permitting', 'Pre-construction', 'Procurement',
        'Site Preparation', 'Foundation Construction', 'Framing', 'Roofing',
        'Rough-in MEP', 'Insulation', 'Drywall', 'Interior Finishes',
        'Exterior Finishes', 'Final Inspections', 'Punch List', 'Closeout',
      ]
      const milestoneIndex = new Map<string, number>()
      for (let i = 0; i < ordering.length; i++) milestoneIndex.set(ordering[i].toLowerCase(), i)

      const issues: IntegrityIssue[] = []
      const activeOrDone = ctx.milestones.filter(m => ['in_progress', 'completed'].includes(m.status))

      for (const ms of activeOrDone) {
        const msIdx = milestoneIndex.get(ms.name.toLowerCase())
        if (msIdx === undefined) continue
        // Check all predecessors
        for (let pi = 0; pi < msIdx; pi++) {
          const prereqName = ordering[pi]
          const prereq = ctx.milestones.find(m => m.name.toLowerCase() === prereqName.toLowerCase())
          if (prereq && ['pending', 'not_started'].includes(prereq.status)) {
            issues.push(issue(ctx, this, `"${ms.name}" is ${ms.status} but prerequisite "${prereq.name}" is ${prereq.status}`, {
              entity_id: ms.id,
              entity_type: 'milestone',
              metadata: { milestone_name: ms.name, milestone_status: ms.status, prerequisite_name: prereq.name, prerequisite_status: prereq.status },
            }))
          }
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { milestone_name: string; milestone_status: string } | undefined
        if (!meta) return { fixed: false, description: 'No metadata' }
        await supabase.from('milestones').update({ status: 'pending' }).eq('id', iss.entity_id)
        return { fixed: true, description: `Reset milestone "${meta.milestone_name}" from "${meta.milestone_status}" to "pending" (prerequisite not complete)` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'MIL-002', name: 'Milestones Without Target Date', severity: 'low', category: 'milestones', autoFixable: false,
    async check(ctx) {
      const missing = ctx.milestones.filter(m => !m.target_date)
      return missing.map(m => issue(ctx, this, `Milestone "${m.name}" has no target date`, {
        entity_id: m.id,
        entity_type: 'milestone',
      }))
    },
  },

  // ---- VENDORS ----
  {
    id: 'VND-001', name: 'Missing Vendor Records', severity: 'medium', category: 'vendors', autoFixable: true,
    async check(ctx) {
      const vendorLower = new Set(ctx.vendors.map(v => v.company_name.toLowerCase()))
      const bidVendors = [...new Set(ctx.bids.map(b => b.vendor_name).filter(Boolean))]
      const issues: IntegrityIssue[] = []
      for (const name of bidVendors) {
        if (!vendorLower.has(name.toLowerCase())) {
          issues.push(issue(ctx, this, `No vendor record for bid vendor "${name}"`, {
            entity_type: 'vendor',
            metadata: { vendor_name: name, category: ctx.bids.find(b => b.vendor_name === name)?.category || 'General' },
          }))
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { vendor_name: string; category: string } | undefined
        if (!meta) return { fixed: false, description: 'No metadata' }
        // Check if vendor exists RIGHT NOW (may have been created earlier in this run)
        const { data: existing } = await supabase.from('vendors')
          .select('id').eq('project_id', iss.project_id)
          .ilike('company_name', meta.vendor_name).limit(1)
        if (existing && existing.length > 0) {
          return { fixed: true, description: `Vendor "${meta.vendor_name}" already exists` }
        }
        await supabase.from('vendors').insert({
          project_id: iss.project_id,
          company_name: meta.vendor_name,
          category: meta.category,
          status: 'potential',
        })
        return { fixed: true, description: `Created vendor record for "${meta.vendor_name}"` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'VND-002', name: 'Duplicate Vendor Names in Vendors Table', severity: 'medium', category: 'vendors', autoFixable: true,
    async check(ctx) {
      const issues: IntegrityIssue[] = []
      const reported = new Set<string>()
      for (let i = 0; i < ctx.vendors.length; i++) {
        for (let j = i + 1; j < ctx.vendors.length; j++) {
          if (areLikelyDuplicateVendors(ctx.vendors[i].company_name, ctx.vendors[j].company_name)) {
            const key = [ctx.vendors[i].id, ctx.vendors[j].id].sort().join('|')
            if (reported.has(key)) continue
            reported.add(key)
            issues.push(issue(ctx, this, `Likely duplicate vendors: "${ctx.vendors[i].company_name}" and "${ctx.vendors[j].company_name}"`, {
              entity_ids: [ctx.vendors[i].id, ctx.vendors[j].id],
              metadata: { vendor_names: [ctx.vendors[i].company_name, ctx.vendors[j].company_name] },
            }))
          }
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { vendor_names: string[] } | undefined
        const vendorIds = iss.entity_ids || []
        if (!meta?.vendor_names?.length || vendorIds.length < 2) return { fixed: false, description: 'No metadata or vendor IDs' }

        // Pick canonical name and assign IDs accordingly
        const canonicalName = pickCanonicalName([...meta.vendor_names])
        const canonicalIdx = meta.vendor_names.indexOf(canonicalName)
        const canonicalId = canonicalIdx >= 0 ? vendorIds[canonicalIdx] : vendorIds[0]
        const mergeAwayId = vendorIds.find(id => id !== canonicalId) || vendorIds[1]

        // Reassign bids from the non-canonical vendor to the canonical one
        await supabase.from('bids').update({ vendor_id: canonicalId }).eq('vendor_id', mergeAwayId)

        // Delete the non-canonical vendor record
        await supabase.from('vendors').delete().eq('id', mergeAwayId)

        return { fixed: true, description: `Merged vendor "${meta.vendor_names.find(n => n !== canonicalName) || mergeAwayId}" into "${canonicalName}" and deleted duplicate` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },

  // ---- PERMITS ----
  {
    id: 'PRM-001', name: 'Missing Known Permits', severity: 'high', category: 'permits', autoFixable: true,
    async check(ctx) {
      const issues: IntegrityIssue[] = []
      const permitTypes = ctx.permits.map(p => (p.type || '').toLowerCase())

      // Check for septic/OSSF permit if Well & Septic bids exist
      const hasSepticBid = ctx.bids.some(b => (b.category || '').toLowerCase().includes('septic') || (b.category || '').toLowerCase().includes('well'))
      if (hasSepticBid) {
        const hasSepticPermit = permitTypes.some(t => t.includes('septic') || t.includes('ossf'))
        if (!hasSepticPermit) {
          issues.push(issue(ctx, this, 'Bids exist for Well & Septic but no OSSF/septic permit found', {
            metadata: { missing_permit: 'OSSF/Septic' },
          }))
        }
      }

      // Check building permit always exists
      const hasBuildingPermit = permitTypes.some(t => t.includes('building') || t.includes('construction'))
      if (!hasBuildingPermit) {
        issues.push(issue(ctx, this, 'No building/construction permit found', {
          metadata: { missing_permit: 'Building Permit' },
        }))
      }

      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { missing_permit: string } | undefined
        if (!meta) return { fixed: false, description: 'No metadata' }
        await supabase.from('permits').insert({
          project_id: iss.project_id,
          type: meta.missing_permit,
          status: 'not_started',
        })
        return { fixed: true, description: `Created permit record for "${meta.missing_permit}" with status "not_started"` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },

  // ---- SELECTIONS ----
  {
    id: 'SEL-001', name: 'Selected Bid Without Selection', severity: 'medium', category: 'selections', autoFixable: true,
    async check(ctx) {
      const bidToSelectionCategory: Record<string, string> = {
        'Plumbing Fixtures': 'plumbing', 'Lighting Fixtures': 'lighting', 'Appliances': 'appliance',
        'Tile': 'tile', 'Painting': 'paint', 'Doors & Trim': 'hardware', 'Countertops': 'countertop',
        'Flooring': 'flooring', 'Cabinetry': 'cabinetry', 'Windows & Doors': 'windows',
      }
      const selectedBids = ctx.bids.filter(b => b.status === 'selected')
      const selectionCategories = new Set(ctx.selections.map(s => s.category.toLowerCase()))
      const issues: IntegrityIssue[] = []
      for (const bid of selectedBids) {
        const selCat = bidToSelectionCategory[bid.category]
        if (!selCat) continue
        if (!selectionCategories.has(selCat.toLowerCase())) {
          issues.push(issue(ctx, this, `Bid from "${bid.vendor_name}" is selected for "${bid.category}" but no selection record exists for "${selCat}"`, {
            entity_id: bid.id,
            entity_type: 'bid',
            metadata: { bid_id: bid.id, bid_category: bid.category, selection_category: selCat, vendor_name: bid.vendor_name },
          }))
        }
      }
      return issues
    },
    async fix(iss) {
      try {
        const meta = iss.metadata as { selection_category: string; bid_id: string } | undefined
        if (!meta) return { fixed: false, description: 'No metadata' }
        await supabase.from('selections').insert({
          project_id: iss.project_id,
          category: meta.selection_category,
          status: 'selected',
          bid_id: meta.bid_id,
        })
        return { fixed: true, description: `Created selection for "${meta.selection_category}" linked to bid` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'SEL-002', name: 'No Decided Selections', severity: 'low', category: 'selections', autoFixable: false,
    async check(ctx) {
      const decided = ctx.selections.filter(s => s.status === 'decided')
      const selected = ctx.selections.filter(s => s.status === 'selected')
      if (decided.length === 0 && selected.length > 0) {
        return [issue(ctx, this, `${selected.length} selection(s) are "selected" but none have been moved to "decided"`, {
          metadata: { selected_count: selected.length },
        })]
      }
      return []
    },
  },
  {
    id: 'SEL-003', name: 'Selection Linked to Rejected Bid', severity: 'low', category: 'selections', autoFixable: true,
    async check(ctx) {
      const rejectedBidIds = new Set(ctx.bids.filter(b => b.status === 'rejected').map(b => b.id))
      const bad = ctx.selections.filter(s => s.bid_id && rejectedBidIds.has(s.bid_id))
      return bad.map(s => issue(ctx, this, `Selection "${s.category}" is linked to a rejected bid`, {
        entity_id: s.id,
        entity_type: 'selection',
        metadata: { selection_category: s.category, bid_id: s.bid_id },
      }))
    },
    async fix(iss) {
      try {
        await supabase.from('selections').update({ bid_id: null, status: 'considering' }).eq('id', iss.entity_id)
        return { fixed: true, description: 'Unlinked rejected bid and set selection to "considering"' }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },

  // ---- PROJECT ----
  {
    id: 'PRJ-001', name: 'Stale Project Record', severity: 'high', category: 'project', autoFixable: true,
    async check(ctx) {
      const daysSince = daysBetween(ctx.project.updated_at, new Date())
      if (daysSince > 7) {
        return [issue(ctx, this, `Project record not updated in ${Math.round(daysSince)} days`, {
          entity_id: ctx.project.id,
          entity_type: 'project',
          metadata: { last_updated: ctx.project.updated_at, days_stale: Math.round(daysSince) },
        })]
      }
      return []
    },
    async fix(iss) {
      try {
        await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', iss.entity_id)
        return { fixed: true, description: 'Updated project updated_at to now' }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },

  // ---- STATUS ----
  {
    id: 'STS-001', name: 'Broken AI Summary', severity: 'high', category: 'status', autoFixable: true,
    async check(ctx) {
      if (ctx.statusRows.length === 0) return []
      const latest = ctx.statusRows[0]
      const broken = !latest.ai_summary || latest.ai_summary.includes('Summary not available') || latest.ai_summary.includes('not available')
      if (broken) {
        return [issue(ctx, this, 'Latest project status has a broken or empty AI summary', {
          entity_id: latest.id,
          entity_type: 'project_status',
        })]
      }
      return []
    },
    async fix(iss) {
      try {
        const fullCtx = await getFullProjectContext(iss.project_id)
        if (!fullCtx) return { fixed: false, description: 'Could not load full project context' }
        const snapshot = generateProjectStatusFromData(fullCtx)
        await supabase.from('project_status').update({
          ai_summary: snapshot.ai_summary,
          hot_topics: snapshot.hot_topics,
          action_items: snapshot.action_items,
          recent_decisions: snapshot.recent_decisions,
          last_updated: new Date().toISOString(),
        }).eq('id', iss.entity_id)
        return { fixed: true, description: 'Regenerated project status from data' }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
  {
    id: 'STS-002', name: 'Stale Status', severity: 'medium', category: 'status', autoFixable: true,
    async check(ctx) {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const recent = ctx.statusRows.find(s => new Date(s.date) >= threeDaysAgo)
      if (!recent) {
        return [issue(ctx, this, 'No project status record in the last 3 days', {
          entity_type: 'project_status',
          metadata: { last_status_date: ctx.statusRows[0]?.date ?? 'none' },
        })]
      }
      return []
    },
    async fix(iss) {
      try {
        const fullCtx = await getFullProjectContext(iss.project_id)
        if (!fullCtx) return { fixed: false, description: 'Could not load full project context' }
        const snapshot = generateProjectStatusFromData(fullCtx)
        const today = new Date().toISOString().slice(0, 10)
        await supabase.from('project_status').upsert({
          project_id: iss.project_id,
          date: today,
          ai_summary: snapshot.ai_summary,
          hot_topics: snapshot.hot_topics,
          action_items: snapshot.action_items,
          recent_decisions: snapshot.recent_decisions,
          last_updated: new Date().toISOString(),
        }, { onConflict: 'project_id,date' })
        return { fixed: true, description: `Generated status for ${today}` }
      } catch (e) {
        return { fixed: false, description: `Error: ${e instanceof Error ? e.message : String(e)}` }
      }
    },
  },
]

// ---------------------------------------------------------------------------
// Issue Persistence
// ---------------------------------------------------------------------------

async function persistIssues(runId: string | null, projectId: string, issues: IntegrityIssue[]): Promise<void> {
  for (const iss of issues) {
    // entity_id must be a valid UUID or null — don't use hashed entity_ids
    const entityKey = iss.entity_id || null
    const now = new Date().toISOString()

    // Look for existing open issue with same dedup key
    let query = supabase
      .from('integrity_issues')
      .select('id')
      .eq('project_id', projectId)
      .eq('rule_id', iss.rule_id)
      .eq('resolution_status', 'open')

    if (entityKey) {
      query = query.eq('entity_id', entityKey)
    } else {
      query = query.is('entity_id', null)
    }

    const { data: existing } = await query.limit(1)

    if (existing && existing.length > 0) {
      // Update existing
      await supabase.from('integrity_issues').update({
        last_detected_at: now,
        run_id: runId,
        description: iss.description,
        metadata: iss.metadata,
        severity: iss.severity,
        fix_applied: iss.fix_applied,
        fix_description: iss.fix_description,
        fix_applied_at: iss.fix_applied_at,
        resolution_status: iss.fix_applied ? 'auto_fixed' : 'open',
      }).eq('id', existing[0].id)
    } else {
      // Insert new
      await supabase.from('integrity_issues').insert({
        project_id: projectId,
        run_id: runId || null,
        rule_id: iss.rule_id,
        rule_name: iss.rule_name,
        severity: iss.severity,
        category: iss.category,
        description: iss.description,
        entity_type: iss.entity_type || null,
        entity_id: entityKey,
        entity_ids: iss.entity_ids || null,
        auto_fixable: iss.auto_fixable,
        fix_applied: iss.fix_applied,
        fix_description: iss.fix_description || null,
        fix_applied_at: iss.fix_applied_at || null,
        resolution_status: iss.fix_applied ? 'auto_fixed' : 'open',
        metadata: iss.metadata || null,
        first_detected_at: now,
        last_detected_at: now,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Main Entry Points
// ---------------------------------------------------------------------------

export async function runIntegrityCheck(
  projectId: string,
  options?: { triggerType?: IntegrityTrigger; runId?: string },
): Promise<IntegrityRunResult> {
  const triggerType = options?.triggerType ?? 'manual'
  const startedAt = new Date()
  console.log(`[integrity] Starting integrity check for project ${projectId} (trigger: ${triggerType})`)

  // Create run record
  const { data: runRow, error: runInsertError } = await supabase.from('integrity_runs').insert({
    project_id: projectId,
    trigger_type: triggerType,
    started_at: startedAt.toISOString(),
  }).select('id').single()

  if (runInsertError) {
    console.error(`[integrity] Failed to create run record: ${runInsertError.message}`)
  }

  const runId = options?.runId ?? runRow?.id ?? null

  // Load context
  const ctx = await loadIntegrityContext(projectId)
  console.log(`[integrity] Context loaded: ${ctx.budgetItems.length} budget items, ${ctx.bids.length} bids, ${ctx.tasks.length} tasks, ${ctx.milestones.length} milestones`)

  // Run all rules
  const allIssues: IntegrityIssue[] = []
  const errors: string[] = []

  for (const rule of RULES) {
    try {
      const found = await rule.check(ctx)
      for (const iss of found) {
        iss.run_id = runId ?? undefined
        allIssues.push(iss)
      }
    } catch (e) {
      const msg = `Rule ${rule.id} failed: ${e instanceof Error ? e.message : String(e)}`
      console.error(`[integrity] ${msg}`)
      errors.push(msg)
    }
  }

  console.log(`[integrity] Found ${allIssues.length} issues from ${RULES.length} rules`)

  // Auto-fix where possible
  let autoFixedCount = 0
  for (const iss of allIssues) {
    if (!iss.auto_fixable) continue
    const rule = RULES.find(r => r.id === iss.rule_id)
    if (!rule?.fix) continue
    try {
      const result = await rule.fix(iss)
      if (result.fixed) {
        iss.fix_applied = true
        iss.fix_description = result.description
        iss.fix_applied_at = new Date().toISOString()
        iss.resolution_status = 'auto_fixed'
        autoFixedCount++
        console.log(`[integrity] Auto-fixed ${iss.rule_id}: ${result.description}`)
      }
    } catch (e) {
      const msg = `Auto-fix for ${iss.rule_id} failed: ${e instanceof Error ? e.message : String(e)}`
      console.error(`[integrity] ${msg}`)
      errors.push(msg)
    }
  }

  // Persist issues (even if run record creation failed)
  try {
    await persistIssues(runId ?? null, projectId, allIssues)
  } catch (e) {
    const msg = `Issue persistence failed: ${e instanceof Error ? e.message : String(e)}`
    console.error(`[integrity] ${msg}`)
    errors.push(msg)
  }

  // Calculate score
  const { score, breakdown } = calculateIntegrityScore(allIssues)
  const completedAt = new Date()
  const durationMs = completedAt.getTime() - startedAt.getTime()

  const result: IntegrityRunResult = {
    run_id: runId ?? undefined,
    project_id: projectId,
    trigger_type: triggerType,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    rules_checked: RULES.length,
    issues_found: allIssues.length,
    issues_auto_fixed: autoFixedCount,
    issues_flagged: allIssues.filter(i => i.resolution_status === 'open').length,
    integrity_score: score,
    score_breakdown: breakdown,
    errors,
    duration_ms: durationMs,
  }

  // Update run record (if it was created successfully)
  if (runId) {
    await supabase.from('integrity_runs').update({
      completed_at: completedAt.toISOString(),
      rules_checked: result.rules_checked,
      issues_found: result.issues_found,
      issues_auto_fixed: result.issues_auto_fixed,
      issues_flagged: result.issues_flagged,
      integrity_score: score,
      score_breakdown: breakdown,
      errors,
      duration_ms: durationMs,
    }).eq('id', runId)
  }

  console.log(`[integrity] Complete. Score: ${score}/100 | Found: ${allIssues.length} | Fixed: ${autoFixedCount} | Flagged: ${result.issues_flagged} | ${durationMs}ms`)
  return result
}

export async function getLatestIntegrityReport(projectId: string): Promise<IntegrityRunResult | null> {
  const { data } = await supabase
    .from('integrity_runs')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  if (!data) return null

  return {
    run_id: data.id,
    project_id: data.project_id,
    trigger_type: data.trigger_type,
    started_at: data.started_at,
    completed_at: data.completed_at,
    rules_checked: data.rules_checked,
    issues_found: data.issues_found,
    issues_auto_fixed: data.issues_auto_fixed,
    issues_flagged: data.issues_flagged,
    integrity_score: data.integrity_score,
    score_breakdown: data.score_breakdown,
    errors: data.errors ?? [],
    duration_ms: data.duration_ms,
  }
}

export async function getOpenIssues(projectId: string): Promise<IntegrityIssue[]> {
  const { data } = await supabase
    .from('integrity_issues')
    .select('*')
    .eq('project_id', projectId)
    .eq('resolution_status', 'open')
    .order('severity', { ascending: true })

  return (data ?? []) as IntegrityIssue[]
}

export async function dismissIssue(issueId: string): Promise<void> {
  await supabase
    .from('integrity_issues')
    .update({ resolution_status: 'dismissed' })
    .eq('id', issueId)
}

export async function resolveIssue(issueId: string, description: string): Promise<void> {
  await supabase
    .from('integrity_issues')
    .update({
      resolution_status: 'manually_fixed',
      fix_description: description,
      fix_applied_at: new Date().toISOString(),
    })
    .eq('id', issueId)
}
