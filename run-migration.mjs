import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.gyhrvtwtptcxedhokplv:quoMxv9hSfA9tLmY@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database');

    const sql = readFileSync('migrations/002_enhanced_documents_and_rbac.sql', 'utf8');
    
    // Split on semicolons but skip comments-only blocks
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        console.log(`Executing: ${stmt.substring(0, 80)}...`);
        await client.query(stmt);
        console.log('  OK');
      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
      }
    }

    console.log('\nMigration complete!');
  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
  }
}

run();
