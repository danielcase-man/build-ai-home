#!/usr/bin/env tsx
/**
 * Seed Script: Populate Supabase from Dropbox Document Repository
 *
 * Reads structured project documents (JSON, CSV, Markdown) and populates
 * all relevant database tables with timestamped records.
 *
 * Usage:
 *   npm run seed
 *   npx tsx scripts/seed-from-docs.ts
 *   DOCUMENT_REPOSITORY_PATH=/custom/path npx tsx scripts/seed-from-docs.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to bypass RLS.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { runSeed } from '../src/lib/seed-parsers'

// Load .env.local (Next.js convention), fall back to .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}

if (!SERVICE_KEY && !ANON_KEY) {
  console.error('Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

if (!SERVICE_KEY) {
  console.warn('')
  console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Using anon key.')
  console.warn('This will likely fail due to RLS policies.')
  console.warn('Add your service role key from: Supabase Dashboard > Settings > API > service_role key')
  console.warn('')
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY!)

const docPath = process.env.DOCUMENT_REPOSITORY_PATH ||
  '/mnt/c/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove'

async function main() {
  console.log('============================================')
  console.log('  UBuildIt Manager - Database Seed Script')
  console.log('============================================')
  console.log(`  Document source: ${docPath}`)
  console.log(`  Supabase URL:    ${SUPABASE_URL}`)
  console.log(`  Auth method:     ${SERVICE_KEY ? 'service_role key' : 'anon key (may fail)'}`)
  console.log('============================================')
  console.log('')

  const startTime = Date.now()
  const result = await runSeed(supabase, docPath)
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('')
  console.log('============================================')
  console.log('  Seed Results')
  console.log('============================================')
  console.log(`  Project ID: ${result.project.id}`)
  console.log('')
  console.log('  Records inserted:')
  for (const [table, count] of Object.entries(result.counts)) {
    console.log(`    ${table.padEnd(20)} ${count}`)
  }
  console.log('')
  console.log(`  Completed in ${elapsed}s`)

  if (result.errors.length > 0) {
    console.log('')
    console.log(`  Errors (${result.errors.length}):`)
    result.errors.forEach(e => console.log(`    - ${e}`))
    console.log('============================================')
    process.exit(1)
  }

  console.log('============================================')
  console.log('')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
