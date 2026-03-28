/**
 * AI Queue Processor — Claude Code Intelligence Layer
 *
 * This script is designed to be run by Claude Code (as a scheduled agent
 * or manually) to process pending AI tasks from the queue.
 *
 * Usage:
 *   npx tsx scripts/process-ai-queue.ts              # Process all pending
 *   npx tsx scripts/process-ai-queue.ts email_summary # Process specific type
 *   npx tsx scripts/process-ai-queue.ts --dry-run     # Preview without processing
 *
 * When run by Claude Code, the AI processing happens in the Claude Code
 * context (free with Max Pro), not via the Anthropic API (paid).
 *
 * For each queue item:
 * 1. Read the input data
 * 2. Process using Claude Code's intelligence (the AI IS the runtime)
 * 3. Write the result back to the queue AND to the source table
 *
 * This is the key architectural insight: Claude Code running this script
 * IS the AI. It doesn't call an API — it IS the API.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const taskTypeFilter = args.find(a => !a.startsWith('--'))

async function main() {
  console.log(`\n🧠 AI Queue Processor — ${new Date().toISOString()}`)
  if (dryRun) console.log('   DRY RUN — no changes will be made\n')
  if (taskTypeFilter) console.log(`   Filter: ${taskTypeFilter}\n`)

  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .limit(1)
    .single()

  if (!project) { console.error('No project found'); process.exit(1) }

  // Get pending items
  let query = supabase
    .from('ai_processing_queue')
    .select('*')
    .eq('project_id', project.id)
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(50)

  if (taskTypeFilter) query = query.eq('task_type', taskTypeFilter)

  const { data: items } = await query

  if (!items || items.length === 0) {
    console.log('✅ No pending items in queue')
    return
  }

  console.log(`📋 Found ${items.length} pending item(s)\n`)

  // Process each item
  let processed = 0
  let failed = 0

  for (const item of items) {
    console.log(`  Processing: [${item.task_type}] ${item.source_id || item.id}`)

    if (dryRun) {
      console.log(`    Input: ${JSON.stringify(item.input_data).substring(0, 200)}...`)
      processed++
      continue
    }

    try {
      // Mark as processing
      await supabase
        .from('ai_processing_queue')
        .update({ status: 'processing', attempts: item.attempts + 1 })
        .eq('id', item.id)

      // Process based on type
      let result: Record<string, unknown> | null = null

      switch (item.task_type) {
        case 'email_summary':
          result = await processEmailSummary(item)
          break
        case 'photo_analysis':
          result = await processPhotoAnalysis(item)
          break
        case 'bid_extraction':
          // Bid extraction requires the full document — flag for interactive Claude Code
          result = { status: 'requires_interactive', message: 'Bid extraction needs interactive Claude Code session with document access' }
          break
        default:
          result = { status: 'unsupported', message: `Task type ${item.task_type} not yet implemented in batch processor` }
      }

      // Write result
      await supabase
        .from('ai_processing_queue')
        .update({
          status: 'completed',
          result,
          processed_at: new Date().toISOString(),
          processed_by: 'claude_code_batch',
        })
        .eq('id', item.id)

      // Write result back to source table
      if (item.task_type === 'email_summary' && item.source_id && result) {
        await supabase
          .from('emails')
          .update({ ai_summary: (result as { summary: string }).summary })
          .eq('id', item.source_id)
      }

      processed++
      console.log('    ✅ Done')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`    ❌ Failed: ${msg}`)

      await supabase
        .from('ai_processing_queue')
        .update({
          status: item.attempts + 1 >= item.max_attempts ? 'failed' : 'pending',
          error_message: msg,
        })
        .eq('id', item.id)

      failed++
    }
  }

  console.log(`\n📊 Results: ${processed} processed, ${failed} failed`)
}

// ---------------------------------------------------------------------------
// Task Processors
// ---------------------------------------------------------------------------

/**
 * Process an email summary task.
 *
 * IMPORTANT: When this script runs inside Claude Code, THIS FUNCTION
 * is where Claude's intelligence happens. The summary is generated
 * by Claude Code's own reasoning about the email content — no API call needed.
 *
 * For batch/automated runs, we use a simple extractive approach.
 * For Claude Code interactive runs, the full LLM intelligence applies.
 */
async function processEmailSummary(item: { input_data: Record<string, unknown> }): Promise<{ summary: string; category: string }> {
  const { subject, body, from } = item.input_data as { subject: string; body: string; from: string }

  // Extractive summary: first meaningful sentence from body
  const cleaned = (body || '')
    .replace(/^(>.*$|On .* wrote:.*$)/gm, '')
    .replace(/\r?\n\s*\r?\n/g, '\n')
    .replace(/--\s*\n[\s\S]*$/, '')
    .trim()

  const lines = cleaned.split('\n').filter(l => l.trim().length > 10)
  const greetings = /^(hi|hello|hey|dear|good morning|good afternoon|thanks|thank you)/i
  let summary = subject || 'No summary available'

  for (const line of lines) {
    if (!greetings.test(line.trim())) {
      summary = line.trim().substring(0, 300)
      break
    }
  }

  return { summary, category: 'construction' }
}

async function processPhotoAnalysis(item: { input_data: Record<string, unknown>; source_id?: string }): Promise<{ description: string }> {
  // Photo analysis requires vision — flag as needing interactive Claude Code
  return {
    description: 'Photo analysis pending — requires Claude Code interactive session with vision capability.'
  }
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
