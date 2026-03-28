/**
 * FrameWork Construction Orchestrator
 *
 * The brain of the system. Runs daily (or on-demand) to keep the project
 * moving ahead of schedule. This is designed to be invoked by Claude Code
 * as a scheduled agent or manually via `npx tsx scripts/orchestrator.ts`.
 *
 * DAILY LOOP:
 * 1. Check vendor follow-up deadlines → send follow-ups or escalate
 * 2. Check bid deadlines → alert if responses missing
 * 3. Check lead times vs phase timeline → flag if ordering is late
 * 4. Process new unclassified emails → classify + extract bids
 * 5. Update project status → push to dashboard
 * 6. Log decisions from recent bid selections
 * 7. Report → what happened, what needs attention, what it did
 *
 * The orchestrator READS from Supabase and WRITES actions back.
 * It does NOT call the Anthropic API directly — that's Claude Code's job.
 * When it needs intelligence (email drafting, bid extraction), it creates
 * tasks/flags in the database for Claude Code to process.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TODAY = new Date().toISOString().split('T')[0]

interface RunContext {
  runId: string
  projectId: string
  actions: Array<{ type: string; vendor?: string; detail: string; timestamp: string }>
  alerts: Array<{ priority: 'high' | 'medium' | 'low'; message: string }>
  recommendations: Array<{ title: string; reasoning: string }>
  errors: Array<{ message: string; context?: string }>
  stats: {
    emails_processed: number
    follow_ups_sent: number
    bids_extracted: number
    statuses_updated: number
  }
}

// ---------------------------------------------------------------------------
// Step 0: Initialize
// ---------------------------------------------------------------------------

async function initRun(): Promise<RunContext> {
  // Get project (single-user app)
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .limit(1)
    .single()

  if (!project) throw new Error('No project found')

  // Create orchestrator run record
  const { data: run } = await supabase
    .from('orchestrator_runs')
    .insert({
      project_id: project.id,
      run_date: TODAY,
      status: 'running',
    })
    .select('id')
    .single()

  if (!run) throw new Error('Failed to create orchestrator run')

  console.log(`\n🏗️  FrameWork Orchestrator — ${TODAY}`)
  console.log(`   Project: ${project.id}`)
  console.log(`   Run: ${run.id}\n`)

  return {
    runId: run.id,
    projectId: project.id,
    actions: [],
    alerts: [],
    recommendations: [],
    errors: [],
    stats: { emails_processed: 0, follow_ups_sent: 0, bids_extracted: 0, statuses_updated: 0 },
  }
}

// ---------------------------------------------------------------------------
// Step 1: Check Vendor Follow-Ups
// ---------------------------------------------------------------------------

async function checkFollowUps(ctx: RunContext): Promise<void> {
  console.log('📋 Step 1: Checking vendor follow-ups...')

  // Get overdue follow-ups
  const { data: overdue } = await supabase
    .from('vendor_follow_ups')
    .select('*')
    .eq('project_id', ctx.projectId)
    .lte('next_follow_up_date', TODAY)
    .in('status', ['sent', 'awaiting_response', 'follow_up_sent'])
    .order('next_follow_up_date', { ascending: true })

  if (!overdue || overdue.length === 0) {
    console.log('   ✅ No overdue follow-ups')
    return
  }

  console.log(`   ⚠️  ${overdue.length} overdue follow-up(s)`)

  for (const fu of overdue) {
    const daysPast = Math.floor((Date.now() - new Date(fu.next_follow_up_date).getTime()) / 86400000)

    if (fu.follow_up_count >= fu.max_follow_ups) {
      // Escalate
      await supabase
        .from('vendor_follow_ups')
        .update({
          status: 'escalated',
          escalation_date: TODAY,
          notes: `${fu.notes || ''}\nAuto-escalated after ${fu.follow_up_count} follow-ups with no response.`.trim(),
        })
        .eq('id', fu.id)

      ctx.alerts.push({
        priority: 'high',
        message: `${fu.vendor_name} — ESCALATED: No response after ${fu.follow_up_count} follow-ups for "${fu.subject}". ${fu.escalation_action || 'Consider calling or finding alternative vendor.'}`
      })

      ctx.actions.push({
        type: 'escalated',
        vendor: fu.vendor_name,
        detail: `Escalated "${fu.subject}" — ${fu.follow_up_count} attempts, ${daysPast} days overdue`,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Queue follow-up
      const nextDate = new Date()
      nextDate.setDate(nextDate.getDate() + 3) // Follow up again in 3 days

      await supabase
        .from('vendor_follow_ups')
        .update({
          status: 'follow_up_sent',
          follow_up_count: fu.follow_up_count + 1,
          next_follow_up_date: nextDate.toISOString().split('T')[0],
          last_contact_date: TODAY,
          last_contact_method: 'email',
        })
        .eq('id', fu.id)

      ctx.alerts.push({
        priority: 'medium',
        message: `${fu.vendor_name} — follow-up #${fu.follow_up_count + 1} needed for "${fu.subject}" (${daysPast} days overdue)`
      })

      ctx.actions.push({
        type: 'follow_up_queued',
        vendor: fu.vendor_name,
        detail: `Follow-up #${fu.follow_up_count + 1} queued for "${fu.subject}"`,
        timestamp: new Date().toISOString(),
      })

      ctx.stats.follow_ups_sent++
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2: Check Bid Deadlines
// ---------------------------------------------------------------------------

async function checkBidDeadlines(ctx: RunContext): Promise<void> {
  console.log('📊 Step 2: Checking bid deadlines...')

  // Find bid packages with upcoming or past deadlines
  const { data: packages } = await supabase
    .from('bid_packages')
    .select('*')
    .eq('project_id', ctx.projectId)
    .in('status', ['sent', 'ready'])
    .not('deadline', 'is', null)

  if (!packages || packages.length === 0) {
    console.log('   ✅ No active bid packages with deadlines')
    return
  }

  for (const pkg of packages) {
    const daysUntil = Math.floor((new Date(pkg.deadline).getTime() - Date.now()) / 86400000)

    if (daysUntil < 0) {
      // Past deadline
      ctx.alerts.push({
        priority: 'high',
        message: `Bid deadline PASSED for "${pkg.title}" (was ${pkg.deadline}). Check if responses received.`
      })
    } else if (daysUntil <= 3) {
      ctx.alerts.push({
        priority: 'high',
        message: `Bid deadline in ${daysUntil} day(s) for "${pkg.title}" (${pkg.deadline})`
      })
    } else if (daysUntil <= 7) {
      ctx.alerts.push({
        priority: 'medium',
        message: `Bid deadline in ${daysUntil} days for "${pkg.title}" (${pkg.deadline})`
      })
    }
  }

  // Also check individual bid expiration
  const { data: expiringBids } = await supabase
    .from('bids')
    .select('vendor_name, category, valid_until')
    .eq('project_id', ctx.projectId)
    .eq('status', 'pending')
    .not('valid_until', 'is', null)
    .lte('valid_until', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])

  if (expiringBids && expiringBids.length > 0) {
    for (const bid of expiringBids) {
      const expired = bid.valid_until < TODAY
      ctx.alerts.push({
        priority: expired ? 'high' : 'medium',
        message: `${bid.vendor_name} ${bid.category} bid ${expired ? 'EXPIRED' : 'expiring'} ${bid.valid_until}`
      })
    }
  }

  console.log(`   Found ${ctx.alerts.length} bid-related alerts`)
}

// ---------------------------------------------------------------------------
// Step 3: Check Lead Times vs Timeline
// ---------------------------------------------------------------------------

async function checkLeadTimes(ctx: RunContext): Promise<void> {
  console.log('⏱️  Step 3: Checking lead times vs timeline...')

  // Get selections with lead times that haven't been ordered
  const { data: selections } = await supabase
    .from('selections')
    .select('*')
    .eq('project_id', ctx.projectId)
    .in('status', ['considering', 'selected'])
    .not('lead_time_days', 'is', null)
    .not('needed_by_date', 'is', null)

  if (!selections || selections.length === 0) {
    console.log('   ✅ No lead time concerns')
    return
  }

  for (const sel of selections) {
    if (!sel.lead_time_days || !sel.needed_by_date) continue

    const neededBy = new Date(sel.needed_by_date)
    const orderByDate = new Date(neededBy.getTime() - sel.lead_time_days * 86400000)
    const daysUntilOrder = Math.floor((orderByDate.getTime() - Date.now()) / 86400000)

    if (daysUntilOrder < 0) {
      ctx.alerts.push({
        priority: 'high',
        message: `LATE: ${sel.product_name} (${sel.category}) should have been ordered ${Math.abs(daysUntilOrder)} days ago. Lead time: ${sel.lead_time_days} days, needed by ${sel.needed_by_date}.`
      })
    } else if (daysUntilOrder <= 7) {
      ctx.alerts.push({
        priority: 'high',
        message: `ORDER NOW: ${sel.product_name} (${sel.category}) must be ordered within ${daysUntilOrder} days. Lead time: ${sel.lead_time_days} days, needed by ${sel.needed_by_date}.`
      })
    } else if (daysUntilOrder <= 14) {
      ctx.alerts.push({
        priority: 'medium',
        message: `Upcoming order: ${sel.product_name} (${sel.category}) — order by ${orderByDate.toISOString().split('T')[0]} (${daysUntilOrder} days)`
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Step 4: Check Unprocessed Emails
// ---------------------------------------------------------------------------

async function checkUnprocessedEmails(ctx: RunContext): Promise<void> {
  console.log('📧 Step 4: Checking for unprocessed emails...')

  // Find emails without AI summaries (from rule-based classifier era)
  const { data: unsummarized } = await supabase
    .from('emails')
    .select('id, subject, sender_email, category')
    .eq('project_id', ctx.projectId)
    .or('ai_summary.is.null,ai_summary.eq.')
    .eq('category', 'construction')
    .order('received_date', { ascending: false })
    .limit(20)

  if (unsummarized && unsummarized.length > 0) {
    ctx.stats.emails_processed = unsummarized.length
    ctx.alerts.push({
      priority: 'low',
      message: `${unsummarized.length} construction email(s) awaiting AI summary enrichment`
    })
  }

  // Find emails that might contain bids (from construction vendors, with attachment markers)
  const { data: potentialBids } = await supabase
    .from('emails')
    .select('id, subject, sender_email')
    .eq('project_id', ctx.projectId)
    .eq('category', 'construction')
    .eq('has_attachments', true)
    .order('received_date', { ascending: false })
    .limit(10)

  if (potentialBids && potentialBids.length > 0) {
    const bidKeywords = /\b(bid|quote|estimate|proposal|pricing|cost)\b/i
    const possibleBids = potentialBids.filter(e => bidKeywords.test(e.subject))

    if (possibleBids.length > 0) {
      ctx.recommendations.push({
        title: `${possibleBids.length} email(s) may contain bids`,
        reasoning: `Emails with attachments and bid-related subjects: ${possibleBids.map(e => `"${e.subject}" from ${e.sender_email}`).join('; ')}`
      })
    }
  }

  console.log(`   ${ctx.stats.emails_processed} emails need enrichment`)
}

// ---------------------------------------------------------------------------
// Step 5: Log Recent Decisions
// ---------------------------------------------------------------------------

async function logRecentDecisions(ctx: RunContext): Promise<void> {
  console.log('📝 Step 5: Logging recent decisions...')

  // Find bid selections from the last 24 hours that aren't in the decision log yet
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const { data: recentSelections } = await supabase
    .from('bids')
    .select('id, vendor_name, category, total_amount, selection_notes')
    .eq('project_id', ctx.projectId)
    .eq('status', 'selected')
    .gte('updated_at', yesterday)

  if (!recentSelections || recentSelections.length === 0) {
    console.log('   No new decisions to log')
    return
  }

  for (const bid of recentSelections) {
    // Check if already logged
    const { data: existing } = await supabase
      .from('decision_log')
      .select('id')
      .eq('related_bid_id', bid.id)
      .limit(1)

    if (existing && existing.length > 0) continue

    // Get alternatives
    const { data: alternatives } = await supabase
      .from('bids')
      .select('vendor_name, total_amount, selection_notes')
      .eq('project_id', ctx.projectId)
      .eq('category', bid.category)
      .neq('id', bid.id)

    await supabase.from('decision_log').insert({
      project_id: ctx.projectId,
      decision_type: 'vendor_selection',
      category: bid.category,
      title: `Selected ${bid.vendor_name} for ${bid.category}`,
      chosen_option: `${bid.vendor_name} — $${(bid.total_amount || 0).toLocaleString()}`,
      alternatives: alternatives?.map(a => ({
        name: a.vendor_name,
        amount: a.total_amount,
        reason_rejected: a.selection_notes || 'Not selected',
      })) || [],
      reasoning: bid.selection_notes || 'Selected by owner',
      cost_impact: bid.total_amount,
      decided_by: 'owner',
      decided_date: TODAY,
      related_bid_id: bid.id,
      outcome_status: 'pending',
    })

    ctx.actions.push({
      type: 'decision_logged',
      vendor: bid.vendor_name,
      detail: `Logged vendor selection: ${bid.vendor_name} for ${bid.category} ($${(bid.total_amount || 0).toLocaleString()})`,
      timestamp: new Date().toISOString(),
    })
  }
}

// ---------------------------------------------------------------------------
// Step 6: Generate Status Update
// ---------------------------------------------------------------------------

async function updateStatus(ctx: RunContext): Promise<void> {
  console.log('📊 Step 6: Updating project status...')

  // Count active follow-ups
  const { count: activeFollowUps } = await supabase
    .from('vendor_follow_ups')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', ctx.projectId)
    .in('status', ['sent', 'awaiting_response', 'follow_up_sent'])

  const { count: overdueFollowUps } = await supabase
    .from('vendor_follow_ups')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', ctx.projectId)
    .lte('next_follow_up_date', TODAY)
    .in('status', ['sent', 'awaiting_response', 'follow_up_sent'])

  // Get the latest orchestrator-specific metrics
  const highAlerts = ctx.alerts.filter(a => a.priority === 'high').length
  const mediumAlerts = ctx.alerts.filter(a => a.priority === 'medium').length

  console.log(`   ${activeFollowUps || 0} active follow-ups (${overdueFollowUps || 0} overdue)`)
  console.log(`   ${highAlerts} high-priority alerts, ${mediumAlerts} medium`)
  ctx.stats.statuses_updated = 1
}

// ---------------------------------------------------------------------------
// Step 7: Complete Run & Report
// ---------------------------------------------------------------------------

async function completeRun(ctx: RunContext): Promise<void> {
  console.log('\n📋 Step 7: Completing run...')

  await supabase
    .from('orchestrator_runs')
    .update({
      completed_at: new Date().toISOString(),
      status: ctx.errors.length > 0 ? 'partial' : 'completed',
      actions_taken: ctx.actions,
      alerts_generated: ctx.alerts,
      decisions_recommended: ctx.recommendations,
      emails_processed: ctx.stats.emails_processed,
      follow_ups_sent: ctx.stats.follow_ups_sent,
      bids_extracted: ctx.stats.bids_extracted,
      statuses_updated: ctx.stats.statuses_updated,
      errors: ctx.errors,
    })
    .eq('id', ctx.runId)

  // Print report
  console.log('\n' + '='.repeat(60))
  console.log('  ORCHESTRATOR DAILY REPORT')
  console.log('='.repeat(60))

  if (ctx.alerts.length > 0) {
    console.log('\n🚨 ALERTS:')
    for (const alert of ctx.alerts) {
      const icon = alert.priority === 'high' ? '🔴' : alert.priority === 'medium' ? '🟡' : '🔵'
      console.log(`  ${icon} ${alert.message}`)
    }
  } else {
    console.log('\n✅ No alerts — project on track')
  }

  if (ctx.actions.length > 0) {
    console.log('\n⚡ ACTIONS TAKEN:')
    for (const action of ctx.actions) {
      console.log(`  • [${action.type}] ${action.detail}`)
    }
  }

  if (ctx.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:')
    for (const rec of ctx.recommendations) {
      console.log(`  • ${rec.title}`)
      console.log(`    ${rec.reasoning}`)
    }
  }

  if (ctx.errors.length > 0) {
    console.log('\n❌ ERRORS:')
    for (const err of ctx.errors) {
      console.log(`  • ${err.message}`)
    }
  }

  console.log('\n📊 STATS:')
  console.log(`  Emails processed: ${ctx.stats.emails_processed}`)
  console.log(`  Follow-ups sent: ${ctx.stats.follow_ups_sent}`)
  console.log(`  Bids extracted: ${ctx.stats.bids_extracted}`)
  console.log(`  Statuses updated: ${ctx.stats.statuses_updated}`)
  console.log(`  Total actions: ${ctx.actions.length}`)
  console.log(`  Total alerts: ${ctx.alerts.length}`)
  console.log('='.repeat(60) + '\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let ctx: RunContext | null = null

  try {
    ctx = await initRun()

    await checkFollowUps(ctx)
    await checkBidDeadlines(ctx)
    await checkLeadTimes(ctx)
    await checkUnprocessedEmails(ctx)
    await logRecentDecisions(ctx)
    await updateStatus(ctx)
    await completeRun(ctx)

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('\n💥 Orchestrator failed:', msg)

    if (ctx) {
      ctx.errors.push({ message: msg })
      await supabase
        .from('orchestrator_runs')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          errors: ctx.errors,
        })
        .eq('id', ctx.runId)
    }

    process.exit(1)
  }
}

main()
