/**
 * Run migration 003: Financial Tracking tables
 * Usage: node scripts/run-migration-003.js
 */
const fs = require('fs')
const path = require('path')

async function main() {
  // Dynamic import pg since it may not be installed
  let Client
  try {
    Client = require('pg').Client
  } catch {
    console.log('Installing pg...')
    require('child_process').execSync('npm install pg --no-save', { stdio: 'inherit' })
    Client = require('pg').Client
  }

  // Load .env.local
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      process.env[match[1].trim()] = match[2].trim()
    }
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local')
    process.exit(1)
  }

  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase-migrations', '003-financial-tracking.sql'),
    'utf-8'
  )

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    console.log('Connected to database')

    // Split into individual statements and execute
    // We'll run the whole thing as a single transaction
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')

    console.log('Migration 003 completed successfully!')
    console.log('Tables created: plaid_connections, contracts, invoices, transactions, payments, vendor_match_rules')
    console.log('Column added: vendors.plaid_merchant_name')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Migration failed:', error.message)

    // If it's a "already exists" error, that's OK
    if (error.message.includes('already exists')) {
      console.log('\nSome objects already exist — migration may have been partially applied.')
      console.log('You can safely re-run or apply remaining statements manually.')
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
