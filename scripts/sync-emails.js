#!/usr/bin/env node

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'ubuildit-email-sync-secret-2024';

async function syncEmails() {
  try {
    console.log('🚀 Starting email sync...');
    console.log(`📡 Connecting to: ${APP_URL}`);
    
    const response = await fetch(`${APP_URL}/api/cron/sync-emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Email sync completed successfully!');
      console.log(`📊 Results:`, {
        synced: result.synced || 0,
        total_processed: result.total_processed || 0,
        message: result.message
      });
      
      if (result.nextSync) {
        console.log(`⏰ Next scheduled sync: ${new Date(result.nextSync).toLocaleString()}`);
      }
    } else {
      console.error('❌ Email sync failed:');
      console.error('Status:', response.status);
      console.error('Error:', result);
    }
  } catch (error) {
    console.error('❌ Error during email sync:');
    console.error(error.message);
    
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

// Check if running directly (not imported)
if (require.main === module) {
  syncEmails()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { syncEmails };
