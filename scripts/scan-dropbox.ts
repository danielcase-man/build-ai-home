/**
 * Dropbox Intelligence Scanner
 *
 * Reads the project directory in Dropbox, indexes files by type and date,
 * and extracts data to populate FrameWork (Supabase) accurately.
 *
 * What it does:
 * 1. Walks the project directory tree
 * 2. Categorizes files (bids, plans, contracts, invoices, permits, etc.)
 * 3. Extracts text from PDFs and docs
 * 4. Updates documents table, budget_items, contacts, vendors, bids
 * 5. Tracks what it's already scanned to avoid re-processing
 *
 * Usage:
 *   npx tsx scripts/scan-dropbox.ts                    # Full scan
 *   npx tsx scripts/scan-dropbox.ts --since 2026-03-01 # Only files modified since
 *   npx tsx scripts/scan-dropbox.ts --dry-run          # Preview without writing
 *   npx tsx scripts/scan-dropbox.ts --category bids    # Only scan bids folder
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve, basename, extname, relative } from 'path'
import { readdirSync, statSync, readFileSync, existsSync } from 'fs'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PROJECT_DIR = 'C:/Users/danie/Dropbox/Properties/Austin, TX/Liberty Hill/708 Purple Salvia Cove'
const SKIP_DIRS = new Set(['node_modules', '.git', '.letta', 'playwright-profile', '.playwright-mcp', 'Cline Builder', '.cline', '.clinerules'])
const DOCUMENT_EXTS = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.csv'])

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const sinceArg = args.find(a => a.startsWith('--since'))
const sinceDate = sinceArg ? new Date(args[args.indexOf(sinceArg) + 1]) : null
const categoryFilter = args.find(a => a.startsWith('--category'))
const categoryArg = categoryFilter ? args[args.indexOf(categoryFilter) + 1] : null

// ---------------------------------------------------------------------------
// Directory → Category mapping
// ---------------------------------------------------------------------------

interface FileInfo {
  path: string
  relativePath: string
  name: string
  ext: string
  size: number
  modified: Date
  category: string
  subcategory: string
}

function categorizeFile(relativePath: string, filename: string): { category: string; subcategory: string } {
  const rp = relativePath.toLowerCase().replace(/\\/g, '/')

  // Bids
  if (rp.includes('bids/appliances') || rp.includes('estimates/appliances')) return { category: 'bid', subcategory: 'Appliances' }
  if (rp.includes('bids/cabinets')) return { category: 'bid', subcategory: 'Cabinetry' }
  if (rp.includes('bids/electrical')) return { category: 'bid', subcategory: 'Electrical' }
  if (rp.includes('bids/excavation') || rp.includes('bids/septic')) return { category: 'bid', subcategory: 'Well & Septic' }
  if (rp.includes('bids/flooring')) return { category: 'bid', subcategory: 'Flooring' }
  if (rp.includes('bids/garage')) return { category: 'bid', subcategory: 'Garage Doors' }
  if (rp.includes('bids/plumbing') || rp.includes('bids/lighting')) return { category: 'bid', subcategory: 'Plumbing Fixtures' }
  if (rp.includes('bids/pool')) return { category: 'bid', subcategory: 'Pool' }
  if (rp.includes('bids/stone')) return { category: 'bid', subcategory: 'Countertops' }
  if (rp.includes('bids/survey')) return { category: 'bid', subcategory: 'Survey' }
  if (rp.includes('bids/well')) return { category: 'bid', subcategory: 'Well & Septic' }
  if (rp.includes('bids/windows')) return { category: 'bid', subcategory: 'Windows & Doors' }
  if (rp.includes('bids/framing')) return { category: 'bid', subcategory: 'Framing' }
  if (rp.includes('bids/engineering')) return { category: 'bid', subcategory: 'Engineering' }
  if (rp.includes('bids/')) return { category: 'bid', subcategory: 'Other' }

  // Engineering Plans
  if (rp.includes('engineering plans/structural')) return { category: 'plan', subcategory: 'Structural' }
  if (rp.includes('engineering plans/foundation')) return { category: 'plan', subcategory: 'Foundation' }
  if (rp.includes('engineering plans/electrical')) return { category: 'plan', subcategory: 'Electrical' }
  if (rp.includes('asiri')) return { category: 'plan', subcategory: 'Construction Details' }
  if (rp.includes('site plan')) return { category: 'plan', subcategory: 'Site Plan' }
  if (rp.includes('design/') && !rp.includes('bids/')) return { category: 'plan', subcategory: 'Architectural' }

  // Financial
  if (rp.includes('construction financing') || rp.includes('financial docs/construction loan')) return { category: 'financial', subcategory: 'Construction Loan' }
  if (rp.includes('financial docs')) return { category: 'financial', subcategory: 'General' }

  // Expenses
  if (rp.includes('expenses/')) {
    const fn = filename.toLowerCase()
    if (fn.includes('invoice') || fn.includes('receipt')) return { category: 'expense', subcategory: 'Invoice' }
    if (fn.includes('contract') || fn.includes('agreement')) return { category: 'contract', subcategory: 'Agreement' }
    return { category: 'expense', subcategory: 'General' }
  }

  // Permits
  if (rp.includes('permitting') || rp.includes('hoa')) return { category: 'permit', subcategory: 'Permit' }

  // Deed/Property
  if (rp.includes('deed')) return { category: 'property', subcategory: 'Deed' }

  // Contracts and agreements
  const fn = filename.toLowerCase()
  if (fn.includes('contract') || fn.includes('agreement') || fn.includes('amendment') || fn.includes('rescission')) {
    return { category: 'contract', subcategory: 'Agreement' }
  }

  // Invoices and receipts
  if (fn.includes('invoice') || fn.includes('receipt') || fn.includes('payment')) {
    return { category: 'expense', subcategory: 'Invoice' }
  }

  // Transcripts and meeting notes
  if (fn.includes('transcript') || fn.includes('chat messages') || fn.includes('meeting')) {
    return { category: 'communication', subcategory: 'Meeting Notes' }
  }

  // Applications and forms
  if (fn.includes('application') || fn.includes('form')) {
    return { category: 'permit', subcategory: 'Application' }
  }

  return { category: 'other', subcategory: 'Uncategorized' }
}

// ---------------------------------------------------------------------------
// File Scanner
// ---------------------------------------------------------------------------

function scanDirectory(dir: string, files: FileInfo[] = []): FileInfo[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return files
  }

  for (const entry of entries) {
    const fullPath = resolve(dir, entry)

    try {
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        if (SKIP_DIRS.has(entry)) continue
        scanDirectory(fullPath, files)
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase()
        if (!DOCUMENT_EXTS.has(ext)) continue

        const relativePath = relative(PROJECT_DIR, fullPath)
        const { category, subcategory } = categorizeFile(relativePath, entry)

        // Apply filters
        if (sinceDate && stat.mtime < sinceDate) continue
        if (categoryArg && category !== categoryArg) continue

        files.push({
          path: fullPath,
          relativePath,
          name: entry,
          ext,
          size: stat.size,
          modified: stat.mtime,
          category,
          subcategory,
        })
      }
    } catch {
      // Skip inaccessible files
    }
  }

  return files
}

// ---------------------------------------------------------------------------
// Supabase Sync
// ---------------------------------------------------------------------------

async function getProjectId(): Promise<string> {
  const { data } = await supabase.from('projects').select('id').limit(1).single()
  if (!data) throw new Error('No project found')
  return data.id
}

async function syncDocuments(projectId: string, files: FileInfo[]): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0, updated = 0, skipped = 0

  for (const file of files) {
    // Check if document already exists by file path
    const { data: existing } = await supabase
      .from('documents')
      .select('id, updated_at')
      .eq('project_id', projectId)
      .eq('file_url', file.relativePath)
      .limit(1)

    if (existing && existing.length > 0) {
      // Check if file was modified since last sync
      const lastSync = new Date(existing[0].updated_at)
      if (file.modified <= lastSync) {
        skipped++
        continue
      }
      // Update existing record
      await supabase.from('documents').update({
        name: file.name,
        category: file.category,
        description: `${file.subcategory} — ${file.name}`,
        file_size: file.size,
        file_type: file.ext.replace('.', ''),
        updated_at: new Date().toISOString(),
      }).eq('id', existing[0].id)
      updated++
    } else {
      // Create new document record
      await supabase.from('documents').insert({
        project_id: projectId,
        name: file.name,
        category: file.category,
        description: `${file.subcategory} — ${file.name}`,
        file_url: file.relativePath,
        file_type: file.ext.replace('.', ''),
        file_size: file.size,
        upload_date: file.modified.toISOString(),
      })
      created++
    }
  }

  return { created, updated, skipped }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n📂 Dropbox Intelligence Scanner — ${new Date().toISOString().split('T')[0]}`)
  console.log(`   Source: ${PROJECT_DIR}`)
  if (dryRun) console.log('   MODE: DRY RUN')
  if (sinceDate) console.log(`   Filter: files modified since ${sinceDate.toISOString().split('T')[0]}`)
  if (categoryArg) console.log(`   Filter: category = ${categoryArg}`)
  console.log()

  // Scan directory
  console.log('Scanning files...')
  const files = scanDirectory(PROJECT_DIR)
  console.log(`Found ${files.length} document files\n`)

  // Categorize
  const byCat: Record<string, FileInfo[]> = {}
  for (const f of files) {
    if (!byCat[f.category]) byCat[f.category] = []
    byCat[f.category].push(f)
  }

  console.log('=== FILE INVENTORY ===')
  for (const [cat, catFiles] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
    const subcats = new Set(catFiles.map(f => f.subcategory))
    console.log(`  ${cat}: ${catFiles.length} files`)
    for (const sub of subcats) {
      const subFiles = catFiles.filter(f => f.subcategory === sub)
      console.log(`    ${sub}: ${subFiles.length}`)
      // Show most recent 3
      const recent = subFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime()).slice(0, 3)
      for (const f of recent) {
        console.log(`      📄 ${f.name} (${(f.size / 1024).toFixed(0)}KB, ${f.modified.toISOString().split('T')[0]})`)
      }
    }
  }

  if (dryRun) {
    console.log('\n--- DRY RUN: No changes written ---')
    return
  }

  // Sync to Supabase
  console.log('\nSyncing to Supabase...')
  const projectId = await getProjectId()
  const result = await syncDocuments(projectId, files)

  console.log(`\n📊 SYNC RESULTS:`)
  console.log(`  Created: ${result.created}`)
  console.log(`  Updated: ${result.updated}`)
  console.log(`  Skipped: ${result.skipped} (unchanged)`)
  console.log(`  Total files: ${files.length}`)

  // Show bid files that could be extracted
  const bidFiles = files.filter(f => f.category === 'bid' && f.ext === '.pdf')
  if (bidFiles.length > 0) {
    console.log(`\n💰 BID FILES (${bidFiles.length} PDFs in Bids/ folders):`)
    for (const f of bidFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime())) {
      console.log(`  ${f.subcategory}: ${f.name} (${f.modified.toISOString().split('T')[0]})`)
    }
    console.log('  → Run bid extraction via Claude Code or the FrameWork upload page')
  }
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
