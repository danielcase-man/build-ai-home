#!/usr/bin/env tsx
/**
 * Add Real Bank/CC Transaction Data to budget_items
 *
 * Inserts verified construction-related transactions from Chase checking
 * and credit card statements into the budget_items table.
 *
 * Usage:
 *   npx tsx scripts/add-transactions.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || (!SERVICE_KEY && !ANON_KEY)) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY!)

interface Transaction {
  date: string          // YYYY-MM-DD
  description: string
  amount: number        // positive = outflow
  category: string
  subcategory?: string
  vendor_name?: string  // for vendor_id lookup
  source: string        // 'Chase Checking 7728' | 'Chase Visa 5189'
}

// All verified construction transactions (Clawson Disposal excluded per owner)
const TRANSACTIONS: Transaction[] = [
  // === LAND ACQUISITION ===
  { date: '2025-06-02', description: 'Wire to Texas National Title - Land purchase 708 Purple Salvia Cove', amount: 221911.95, category: 'Land Acquisition', vendor_name: 'Texas National Title', source: 'Chase Checking 7728' },
  { date: '2025-06-02', description: 'Domestic wire transfer fee - land closing', amount: 35.00, category: 'Land Acquisition', subcategory: 'Closing Costs', source: 'Chase Checking 7728' },
  { date: '2025-06-25', description: 'Prince Development - lot-related payment', amount: 9943.00, category: 'Land Acquisition', subcategory: 'Development Fees', vendor_name: 'Prince Development', source: 'Chase Checking 7728' },

  // === HOA & PROPERTY TAX ===
  { date: '2025-04-02', description: 'Mesa Vista Ranch HOA quarterly payment', amount: 265.00, category: 'HOA & Property Tax', subcategory: 'HOA Dues', source: 'Chase Checking 7728' },
  { date: '2025-04-02', description: 'PayLease processing fee (HOA)', amount: 2.95, category: 'HOA & Property Tax', subcategory: 'Processing Fees', source: 'Chase Checking 7728' },
  { date: '2025-07-02', description: 'Mesa Vista Ranch HOA quarterly payment', amount: 265.00, category: 'HOA & Property Tax', subcategory: 'HOA Dues', source: 'Chase Checking 7728' },
  { date: '2025-07-02', description: 'PayLease processing fee (HOA)', amount: 2.95, category: 'HOA & Property Tax', subcategory: 'Processing Fees', source: 'Chase Checking 7728' },
  { date: '2025-09-12', description: 'Williamson County property tax payment', amount: 408.25, category: 'HOA & Property Tax', subcategory: 'Property Tax', source: 'Chase Checking 7728' },
  { date: '2026-01-06', description: 'Mesa Vista Ranch HOA quarterly payment', amount: 250.00, category: 'HOA & Property Tax', subcategory: 'HOA Dues', source: 'Chase Checking 7728' },

  // === ARCHITECTURAL DESIGN (Kipp Flores) ===
  { date: '2025-07-12', description: 'Kipp Flores Architects - design payment', amount: 2000.00, category: 'Architectural Design', vendor_name: 'Kipp Flores', source: 'Chase Visa 5189' },
  { date: '2025-10-02', description: 'Kipp Flores Architects - design payment', amount: 2000.00, category: 'Architectural Design', vendor_name: 'Kipp Flores', source: 'Chase Visa 5189' },
  { date: '2025-10-20', description: 'Kipp Flores Architects - plan revision', amount: 862.50, category: 'Architectural Design', vendor_name: 'Kipp Flores', source: 'Chase Checking 7728' },
  { date: '2026-01-13', description: 'Kipp Flores Architects - additional services', amount: 100.00, category: 'Architectural Design', vendor_name: 'Kipp Flores', source: 'Chase Visa 5189' },

  // === STRUCTURAL ENGINEERING ===
  { date: '2025-10-30', description: 'Copeland Engineering - structural review', amount: 2650.00, category: 'Structural Engineering', vendor_name: 'Copeland Engineering', source: 'Chase Visa 5189' },
  { date: '2025-11-05', description: 'Copeland Engineering - additional review', amount: 300.00, category: 'Structural Engineering', vendor_name: 'Copeland Engineering', source: 'Chase Visa 5189' },
  { date: '2025-12-03', description: 'Asiri Designs - structural engineering plans', amount: 4150.00, category: 'Structural Engineering', vendor_name: 'Asiri Design', source: 'Chase Visa 5189' },

  // === FOUNDATION ENGINEERING ===
  { date: '2025-10-07', description: 'Synergetic Engineering - foundation engineering', amount: 2500.00, category: 'Foundation Engineering', vendor_name: 'Synergetic/3DayDesign', source: 'Chase Visa 5189' },

  // === CIVIL ENGINEERING ===
  { date: '2026-01-14', description: 'Daniel Arredondo / Four A Engineering - civil engineering', amount: 3165.00, category: 'Civil Engineering', vendor_name: 'Four A Engineering', source: 'Chase Checking 7728' },

  // === SURVEYING ===
  { date: '2025-07-25', description: 'Texas Land Surveying - property survey', amount: 2528.65, category: 'Surveying', source: 'Chase Visa 5189' },
  { date: '2026-01-06', description: 'Texas Land Surveying - additional survey work', amount: 309.00, category: 'Surveying', source: 'Chase Visa 5189' },

  // === UBUILDIT CONSULTING ===
  { date: '2025-08-04', description: 'Texas Home Consultants - UBuildIt planning fee', amount: 5000.00, category: 'Consulting', subcategory: 'UBuildIt', vendor_name: 'UBuildIt', source: 'Chase Checking 7728' },

  // === FLOORING (Kristynik) ===
  { date: '2025-08-11', description: 'Kristynik Hardwoods - flooring deposit', amount: 38507.00, category: 'Flooring', vendor_name: 'Kristynik', source: 'Chase Checking 7728' },
  { date: '2025-11-25', description: 'Kristynik Hardwoods - flooring balance', amount: 14217.00, category: 'Flooring', vendor_name: 'Kristynik', source: 'Chase Checking 7728' },

  // === SEPTIC ===
  { date: '2026-02-05', description: 'Triple C Septic - deposit', amount: 550.00, category: 'Septic', vendor_name: 'Triple C Septic', source: 'Chase Checking 7728' },

  // === POOL DESIGN ===
  { date: '2025-12-22', description: 'Build Your Own Pool (BYOP) - pool design consultation', amount: 2995.00, category: 'Pool Design', vendor_name: 'BYOP', source: 'Chase Visa 5189' },

  // === BUILDING MATERIALS / SAMPLES ===
  { date: '2025-12-01', description: 'James Hardie - siding samples', amount: 70.00, category: 'Building Materials', subcategory: 'Siding', source: 'Chase Visa 5189' },
  { date: '2026-01-21', description: 'Lowes - construction supplies', amount: 843.25, category: 'Building Materials', subcategory: 'Supplies', source: 'Chase Visa 5189' },

  // === SOFTWARE / TOOLS ===
  { date: '2025-11-28', description: 'Renovate AI - renovation planning software', amount: 15.00, category: 'Software & Tools', source: 'Chase Checking 7728' },
  { date: '2025-12-29', description: 'Renovate AI - renovation planning software', amount: 15.00, category: 'Software & Tools', source: 'Chase Checking 7728' },
  { date: '2026-01-27', description: 'Renovate AI - renovation planning software', amount: 15.00, category: 'Software & Tools', source: 'Chase Checking 7728' },
]

async function main() {
  console.log('============================================')
  console.log('  Add Construction Transactions to Database')
  console.log('============================================')
  console.log(`  Transactions to insert: ${TRANSACTIONS.length}`)
  console.log('')

  // 1. Find the project
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, name')
    .ilike('address', '%708 Purple Salvia Cove%')
    .limit(1)
    .single()

  if (projErr || !project) {
    console.error('Could not find project:', projErr?.message)
    process.exit(1)
  }
  console.log(`  Project: ${project.name} (${project.id})`)

  // 2. Get vendor map for linking
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name')
    .eq('project_id', project.id)

  const vendorMap = new Map<string, string>()
  for (const v of (vendors || [])) {
    vendorMap.set(v.name, v.id)
  }
  console.log(`  Vendors loaded: ${vendorMap.size}`)

  // 3. Delete existing transaction-sourced budget items (idempotent re-run)
  const { error: delErr } = await supabase
    .from('budget_items')
    .delete()
    .eq('project_id', project.id)
    .like('notes', 'Source: Chase%')

  if (delErr) {
    console.error('Error clearing old transactions:', delErr.message)
  } else {
    console.log('  Cleared previous transaction records')
  }

  // 4. Build records
  const records = TRANSACTIONS.map(tx => {
    // Try to find vendor
    let vendorId: string | null = null
    if (tx.vendor_name && vendorMap.has(tx.vendor_name)) {
      vendorId = vendorMap.get(tx.vendor_name)!
    } else if (tx.vendor_name) {
      // Partial match
      const lower = tx.vendor_name.toLowerCase()
      for (const [name, id] of Array.from(vendorMap.entries())) {
        if (name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase())) {
          vendorId = id
          break
        }
      }
    }

    return {
      project_id: project.id,
      category: tx.category,
      subcategory: tx.subcategory || null,
      description: tx.description,
      estimated_cost: tx.amount,
      actual_cost: tx.amount,
      vendor_id: vendorId,
      status: 'paid',
      payment_date: tx.date,
      notes: `Source: ${tx.source}`,
    }
  })

  // 5. Insert in batches
  const BATCH_SIZE = 25
  let inserted = 0
  const errors: string[] = []

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('budget_items').insert(batch)
    if (error) {
      errors.push(`Batch ${i}: ${error.message}`)
      console.error(`  Error inserting batch at ${i}:`, error.message)
    } else {
      inserted += batch.length
    }
  }

  // 6. Summary
  console.log('')
  console.log('============================================')
  console.log('  Results')
  console.log('============================================')
  console.log(`  Records inserted: ${inserted}`)

  // Compute totals by category
  const byCategory = new Map<string, { count: number; total: number }>()
  for (const tx of TRANSACTIONS) {
    const cat = byCategory.get(tx.category) || { count: 0, total: 0 }
    cat.count++
    cat.total += tx.amount
    byCategory.set(tx.category, cat)
  }

  console.log('')
  console.log('  By category:')
  let grandTotal = 0
  for (const [cat, info] of Array.from(byCategory.entries())) {
    console.log(`    ${cat.padEnd(25)} ${info.count} txns   $${info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
    grandTotal += info.total
  }
  console.log('')
  console.log(`  Grand total: $${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)

  if (errors.length > 0) {
    console.log('')
    console.log(`  Errors (${errors.length}):`)
    errors.forEach(e => console.log(`    - ${e}`))
    process.exit(1)
  }

  console.log('============================================')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
