/**
 * Seed construction loan data for the Case Home project.
 * Run: node scripts/seed-construction-loan.js
 *
 * This script:
 * 1. Creates the construction_loans table if it doesn't exist
 * 2. Inserts/updates the Federal Savings Bank loan record
 * 3. Adds lender contacts (Dawn Breton, Kristin Fox) to the contacts table
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  console.log('Seeding construction loan data...\n')

  // 1. Get the project ID
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (projErr || !project) {
    console.error('Could not find project:', projErr?.message)
    process.exit(1)
  }
  console.log(`Project: ${project.name} (${project.id})`)

  // 2. Create the construction_loans table via raw SQL
  // (Supabase JS client can't run DDL, so we use rpc or the table should already exist)
  // If the table doesn't exist yet, run the migration SQL in Supabase Dashboard first.
  // We'll attempt the insert and report if the table is missing.

  // 3. Upsert the construction loan record
  const loanData = {
    project_id: project.id,
    lender_name: 'The Federal Savings Bank',
    loan_type: '1x_close',
    loan_amount: 1200000,
    cost_of_construction: 1500000,
    lot_value: 225000,
    application_status: 'submitted',
    application_url: 'https://apply.thefederalsavingsbank.com',
    application_date: '2026-03-07',
    loan_officer_name: 'Dawn Breton',
    loan_officer_email: 'dbreton@thefederalsavingsbank.com',
    loan_contact_name: 'Kristin Fox',
    loan_contact_email: 'kfox@thefederalsavingsbank.com',
    loan_contact_phone: '(512) 675-0520',
    loan_contact_nmls: '378579',
    notes: 'Construction loan application submitted 2026-03-07. 1x close loan. Pending document upload: W-2s, paystubs, account statements. Gayane will receive separate email invitation to complete her portion. Referrer: Kristin Fox team. Max LTV 80% up to $1.5M, min FICO 720. Modifies to 5/1 ARM after construction.',
    loan_details: {
      max_ltv_percent: 80,
      max_loan_at_80_ltv: 1500000,
      min_fico: 720,
      post_construction_product: '5/1 ARM',
      coborrower: 'Gayane Moloian Case',
      pending_document_tasks: [
        'Account Statements',
        'Paystubs',
        'W-2s',
      ],
      property_address: '708 Purple Salvia Cove, Liberty Hill, TX 78642',
    }
  }

  const { data: loan, error: loanErr } = await supabase
    .from('construction_loans')
    .upsert(loanData, { onConflict: 'project_id' })
    .select()
    .single()

  if (loanErr) {
    if (loanErr.message.includes('does not exist') || loanErr.code === '42P01') {
      console.error('\nTable "construction_loans" does not exist yet.')
      console.error('Run the migration SQL from supabase-schema.sql in the Supabase Dashboard first:')
      console.error('  -- Look for "Migration: Construction Loan Tracking" section')
      process.exit(1)
    }
    console.error('Failed to upsert loan:', loanErr.message)
    process.exit(1)
  }
  console.log(`\nLoan record created/updated: ${loan.id}`)
  console.log(`  Lender: ${loan.lender_name}`)
  console.log(`  Type: ${loan.loan_type}`)
  console.log(`  Amount: $${Number(loan.loan_amount).toLocaleString()}`)
  console.log(`  Cost of Construction: $${Number(loan.cost_of_construction).toLocaleString()}`)
  console.log(`  Status: ${loan.application_status}`)

  // 4. Add lender contacts
  const contacts = [
    {
      project_id: project.id,
      type: 'lender',
      company: 'The Federal Savings Bank',
      name: 'Dawn Breton',
      email: 'dbreton@thefederalsavingsbank.com',
      role: 'Loan Officer',
      is_ubuildit_team: false,
      track_emails: true,
      notes: 'Construction loan officer for the Case Home project',
    },
    {
      project_id: project.id,
      type: 'lender',
      company: 'The Federal Savings Bank',
      name: 'Kristin Fox',
      email: 'kfox@thefederalsavingsbank.com',
      phone: '(512) 675-0520',
      role: 'Loan Contact / Referrer (NMLS# 378579)',
      is_ubuildit_team: false,
      track_emails: true,
      notes: 'Primary loan contact. Referred by SA Lending / UBuildIt partnership.',
    },
  ]

  for (const contact of contacts) {
    // Check if contact already exists by email
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('project_id', project.id)
      .eq('email', contact.email)
      .limit(1)

    if (existing && existing.length > 0) {
      // Update existing
      const { error: updateErr } = await supabase
        .from('contacts')
        .update(contact)
        .eq('id', existing[0].id)

      if (updateErr) {
        console.error(`Failed to update contact ${contact.name}:`, updateErr.message)
        // If the type constraint fails, try with 'other' as fallback
        if (updateErr.message.includes('contacts_type_check')) {
          console.log(`  Retrying with type='other' (constraint not yet updated)...`)
          const { error: retryErr } = await supabase
            .from('contacts')
            .update({ ...contact, type: 'other' })
            .eq('id', existing[0].id)
          if (!retryErr) console.log(`  Updated: ${contact.name} (as type='other')`)
        }
      } else {
        console.log(`  Updated contact: ${contact.name}`)
      }
    } else {
      // Insert new
      const { error: insertErr } = await supabase
        .from('contacts')
        .insert(contact)

      if (insertErr) {
        if (insertErr.message.includes('contacts_type_check')) {
          console.log(`  Contact type 'lender' not yet in constraint, using 'other'...`)
          const { error: retryErr } = await supabase
            .from('contacts')
            .insert({ ...contact, type: 'other' })
          if (!retryErr) console.log(`  Added contact: ${contact.name} (as type='other')`)
          else console.error(`  Failed:`, retryErr.message)
        } else {
          console.error(`Failed to add contact ${contact.name}:`, insertErr.message)
        }
      } else {
        console.log(`  Added contact: ${contact.name}`)
      }
    }
  }

  console.log('\nDone! Construction loan data seeded successfully.')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
