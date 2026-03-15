/**
 * Push all relevant data from UBuildIt Manager (Supabase) → JobTread
 * Run: node scripts/push-to-jobtread.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const JT_KEY = process.env.JOBTREAD_API_KEY || '22TJdhcj8BiFVMMbUtzBpUpQVY3WJwMurH'
const JT_JOB_ID = process.env.JOBTREAD_JOB_ID || '22PEVyJVCikd'
const JT_API = 'https://api.jobtread.com/pave'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let apiCalls = 0
const RATE_LIMIT_MS = 500 // 500ms between calls to avoid throttling

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function jtQuery(query) {
  apiCalls++
  const body = { query: { $: { grantKey: JT_KEY }, ...query } }
  const res = await fetch(JT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`JT API ${res.status}: ${text}`)
  }
  const data = await res.json()
  if (data.errors) {
    throw new Error(`JT errors: ${JSON.stringify(data.errors)}`)
  }
  await sleep(RATE_LIMIT_MS)
  return data
}

// ── Push Cost Items (budget_items → JT costItems) ──

async function pushBudgetItems() {
  console.log('\n━━━ PUSHING BUDGET ITEMS → COST ITEMS ━━━')

  const { data: items } = await supabase
    .from('budget_items')
    .select('id, category, subcategory, description, estimated_cost, actual_cost, source, jobtread_id')
    .order('category')

  // Only push items without a jobtread_id
  const toPush = items.filter(i => !i.jobtread_id)
  console.log(`Found ${items.length} total, ${toPush.length} to push (no JT id)`)

  let created = 0, errors = 0
  for (const item of toPush) {
    const name = [item.category, item.subcategory, item.description]
      .filter(Boolean).join(' — ')
    const cost = Math.round((parseFloat(item.estimated_cost) || 0) * 100) // dollars → cents

    try {
      const result = await jtQuery({
        createCostItem: {
          $: { jobId: JT_JOB_ID, name, cost },
          id: {},
        },
      })
      const jtId = result.createCostItem.id

      // Update local record with JT id
      await supabase.from('budget_items').update({ jobtread_id: jtId }).eq('id', item.id)

      created++
      process.stdout.write(`  ✓ ${name.substring(0, 60)} ($${(cost/100).toLocaleString()})\n`)
    } catch (err) {
      errors++
      console.error(`  ✗ ${name}: ${err.message}`)
    }
  }
  console.log(`Budget items: ${created} created, ${errors} errors`)
  return created
}

// ── Push Tasks ──

async function pushTasks() {
  console.log('\n━━━ PUSHING TASKS ━━━')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, due_date, status, priority, jobtread_id, notes')
    .neq('status', 'cancelled')
    .order('title')

  const toPush = tasks.filter(t => !t.jobtread_id)
  console.log(`Found ${tasks.length} total, ${toPush.length} to push (no JT id)`)

  let created = 0, errors = 0
  for (const task of toPush) {
    const params = { jobId: JT_JOB_ID, name: task.title }
    if (task.description) params.description = task.description
    if (task.due_date) params.endDate = task.due_date

    try {
      const result = await jtQuery({
        createTask: {
          $: params,
          id: {},
        },
      })
      const jtId = result.createTask.id

      // Update local record
      await supabase.from('tasks').update({ jobtread_id: jtId }).eq('id', task.id)

      created++
      process.stdout.write(`  ✓ ${task.title.substring(0, 70)}\n`)
    } catch (err) {
      errors++
      console.error(`  ✗ ${task.title}: ${err.message}`)
    }
  }
  console.log(`Tasks: ${created} created, ${errors} errors`)
  return created
}

// ── Push Contacts as Comment ──

async function pushContacts() {
  console.log('\n━━━ PUSHING CONTACTS DIRECTORY ━━━')

  const { data: contacts } = await supabase
    .from('contacts')
    .select('name, role, company, email, phone')
    .order('company')

  if (!contacts || contacts.length === 0) {
    console.log('No contacts to push')
    return 0
  }

  let msg = '📋 PROJECT CONTACTS DIRECTORY\n'
  msg += '══════════════════════════════\n\n'

  contacts.forEach(c => {
    msg += `• ${c.name}`
    if (c.role) msg += ` — ${c.role}`
    if (c.company) msg += ` (${c.company})`
    msg += '\n'
    if (c.email) msg += `  Email: ${c.email}\n`
    if (c.phone) msg += `  Phone: ${c.phone}\n`
    msg += '\n'
  })

  msg += `\n— Synced from UBuildIt Manager on ${new Date().toLocaleDateString()}`

  try {
    await jtQuery({
      createComment: {
        $: { jobId: JT_JOB_ID, message: msg },
        id: {},
      },
    })
    console.log(`  ✓ Contacts directory posted (${contacts.length} contacts)`)
    return 1
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`)
    return 0
  }
}

// ── Push Bids Summary as Comments (one per trade category) ──

async function pushBids() {
  console.log('\n━━━ PUSHING BID SUMMARIES ━━━')

  const { data: bids } = await supabase
    .from('bids')
    .select('vendor_name, category, subcategory, total_amount, status, valid_until, scope_of_work, inclusions, exclusions, payment_terms, lead_time_weeks')
    .order('category')

  if (!bids || bids.length === 0) {
    console.log('No bids to push')
    return 0
  }

  // Group by category
  const byCategory = {}
  bids.forEach(b => {
    if (!byCategory[b.category]) byCategory[b.category] = []
    byCategory[b.category].push(b)
  })

  let created = 0
  for (const [category, catBids] of Object.entries(byCategory)) {
    let msg = `📊 BID COMPARISON: ${category.toUpperCase()}\n`
    msg += '══════════════════════════════\n\n'

    catBids.sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0))

    catBids.forEach(b => {
      const statusIcon = b.status === 'selected' ? '✅' : b.status === 'rejected' ? '❌' : '⏳'
      msg += `${statusIcon} ${b.vendor_name}`
      if (b.subcategory) msg += ` (${b.subcategory})`
      msg += `\n`
      msg += `   Amount: $${(b.total_amount || 0).toLocaleString()}\n`
      msg += `   Status: ${b.status}\n`
      if (b.valid_until) msg += `   Valid Until: ${b.valid_until}\n`
      if (b.lead_time_weeks) msg += `   Lead Time: ${b.lead_time_weeks} weeks\n`
      if (b.scope_of_work) msg += `   Scope: ${b.scope_of_work.substring(0, 200)}\n`
      if (b.inclusions && b.inclusions.length > 0) {
        msg += `   Includes: ${b.inclusions.slice(0, 5).join(', ')}\n`
      }
      if (b.exclusions && b.exclusions.length > 0) {
        msg += `   Excludes: ${b.exclusions.slice(0, 5).join(', ')}\n`
      }
      msg += '\n'
    })

    const lowest = catBids[0]
    const highest = catBids[catBids.length - 1]
    msg += `Range: $${(lowest.total_amount||0).toLocaleString()} — $${(highest.total_amount||0).toLocaleString()}\n`

    const selected = catBids.filter(b => b.status === 'selected')
    if (selected.length > 0) {
      msg += `Selected: ${selected.map(b => b.vendor_name).join(', ')}\n`
    }

    msg += `\n— Synced from UBuildIt Manager on ${new Date().toLocaleDateString()}`

    try {
      await jtQuery({
        createComment: {
          $: { targetId: JT_JOB_ID, targetType: 'job', message: msg },
        },
      })
      console.log(`  ✓ ${category}: ${catBids.length} bids posted`)
      created++
    } catch (err) {
      console.error(`  ✗ ${category}: ${err.message}`)
    }
  }

  console.log(`Bid summaries: ${created} categories posted`)
  return created
}

// ── Push Milestones as a Comment ──

async function pushMilestones() {
  console.log('\n━━━ PUSHING MILESTONES ━━━')

  const { data: milestones } = await supabase
    .from('milestones')
    .select('name, status, target_date, description')
    .order('created_at')

  if (!milestones || milestones.length === 0) {
    console.log('No milestones to push')
    return 0
  }

  let msg = '🏗️ CONSTRUCTION MILESTONES\n'
  msg += '══════════════════════════════\n\n'

  milestones.forEach((m, i) => {
    const icon = m.status === 'completed' ? '✅' : m.status === 'in_progress' ? '🔨' : '⬜'
    msg += `${i + 1}. ${icon} ${m.name}`
    if (m.target_date) msg += ` — Target: ${m.target_date}`
    msg += ` [${m.status}]\n`
    if (m.description) msg += `   ${m.description.substring(0, 150)}\n`
  })

  msg += `\n— Synced from UBuildIt Manager on ${new Date().toLocaleDateString()}`

  try {
    await jtQuery({
      createComment: {
        $: { jobId: JT_JOB_ID, message: msg },
        id: {},
      },
    })
    console.log(`  ✓ Milestones posted (${milestones.length} milestones)`)
    return 1
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`)
    return 0
  }
}

// ── Push Planning Phase Status ──

async function pushPlanningStatus() {
  console.log('\n━━━ PUSHING PLANNING PHASE STATUS ━━━')

  const { data: steps } = await supabase
    .from('planning_phase_steps')
    .select('step_number, name, status')
    .order('step_number')

  if (!steps || steps.length === 0) {
    console.log('No planning steps to push')
    return 0
  }

  let msg = '📋 UBUILDIT PLANNING PHASE STATUS\n'
  msg += '══════════════════════════════\n\n'

  steps.forEach(s => {
    const icon = s.status === 'completed' ? '✅' : s.status === 'in_progress' ? '🔄' : '⬜'
    msg += `Step ${s.step_number}: ${icon} ${s.name} [${s.status}]\n`
  })

  const completed = steps.filter(s => s.status === 'completed').length
  msg += `\nProgress: ${completed}/${steps.length} complete`
  msg += `\n\n— Synced from UBuildIt Manager on ${new Date().toLocaleDateString()}`

  try {
    await jtQuery({
      createComment: {
        $: { jobId: JT_JOB_ID, message: msg },
        id: {},
      },
    })
    console.log(`  ✓ Planning status posted (${completed}/${steps.length} complete)`)
    return 1
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`)
    return 0
  }
}

// ── Main ──

async function main() {
  console.log('╔═══════════════════════════════════════════════╗')
  console.log('║  UBuildIt Manager → JobTread Data Push        ║')
  console.log('║  Case Home #23                                ║')
  console.log('╚═══════════════════════════════════════════════╝')

  const start = Date.now()

  const costItems = await pushBudgetItems()
  const tasks = await pushTasks()
  const contacts = await pushContacts()
  const bids = await pushBids()
  const milestones = await pushMilestones()
  const planning = await pushPlanningStatus()

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log('\n╔═══════════════════════════════════════════════╗')
  console.log('║  PUSH COMPLETE                                ║')
  console.log('╠═══════════════════════════════════════════════╣')
  console.log(`║  Cost Items created:  ${String(costItems).padStart(4)}                    ║`)
  console.log(`║  Tasks created:       ${String(tasks).padStart(4)}                    ║`)
  console.log(`║  Contact directory:   ${contacts ? ' yes' : '  no'}                    ║`)
  console.log(`║  Bid summaries:       ${String(bids).padStart(4)}                    ║`)
  console.log(`║  Milestones:          ${milestones ? ' yes' : '  no'}                    ║`)
  console.log(`║  Planning status:     ${planning ? ' yes' : '  no'}                    ║`)
  console.log(`║  API calls:           ${String(apiCalls).padStart(4)}                    ║`)
  console.log(`║  Duration:          ${elapsed.padStart(5)}s                    ║`)
  console.log('╚═══════════════════════════════════════════════╝')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
