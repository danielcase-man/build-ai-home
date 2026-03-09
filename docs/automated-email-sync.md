# Automated Email Synchronization Setup

This guide explains how to set up automated daily email fetching and AI summarization for your UBuildIt project.

## Overview

The system automatically:
- Fetches emails from Gmail every day (or more frequently)
- Stores emails in the Supabase database
- Generates AI summaries for each email
- Provides fast loading from stored data
- Eliminates the need for manual email refreshing

## System Components

### 1. Database Storage
- **Email accounts**: Stores OAuth tokens encrypted with AES-256-GCM for automated access
- **Emails**: Stores email content and AI summaries
- **Projects**: Links emails to your construction project

### 2. API Endpoints
- `/api/cron/sync-emails`: Automated sync endpoint
- `/api/emails/fetch`: Returns stored emails (falls back to live API)
- `/api/auth/google/callback`: Stores OAuth tokens during setup

### 3. Email Sources
The system fetches emails from:
- UBuildIt team (@ubuildit.com)
- Project vendors (@kippflores.com, @krystinik.com)
- Any emails mentioning "708 Purple Salvia Cove"

## Setup Methods

Choose one of the following methods to schedule automated email syncing:

---

## Method 1: Vercel Cron Jobs (Recommended for Vercel deployment)

### Step 1: Create vercel.json
Create this file in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-emails",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Schedule options:**
- `"0 8 * * *"` - Daily at 8 AM UTC
- `"0 */4 * * *"` - Every 4 hours
- `"0 8,17 * * *"` - Twice daily (8 AM and 5 PM UTC)

### Step 2: Add Environment Variables
In your Vercel deployment, add:
```
CRON_SECRET=ubuildit-email-sync-secret-2024
```

### Step 3: Deploy
The cron job will automatically start running after deployment.

---

## Method 2: GitHub Actions (For any hosting platform)

### Step 1: Create GitHub Action
Create `.github/workflows/email-sync.yml`:

```yaml
name: Sync Emails Daily

on:
  schedule:
    # Run daily at 8 AM UTC (3 AM CT)
    - cron: '0 8 * * *'
  workflow_dispatch: # Allow manual triggers

jobs:
  sync-emails:
    runs-on: ubuntu-latest
    
    steps:
      - name: Sync Emails
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/cron/sync-emails \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

### Step 2: Add GitHub Secrets
In your GitHub repository settings > Secrets:
- `APP_URL`: Your deployed app URL (e.g., https://yourapp.vercel.app)
- `CRON_SECRET`: ubuildit-email-sync-secret-2024

---

## Method 3: External Cron Service (EasyCron, Cron-job.org)

### Step 1: Choose a Service
- [EasyCron](https://www.easycron.com/) (Free tier available)
- [Cron-job.org](https://cron-job.org/) (Free)
- [Cronhooks](https://cronhooks.io/) (Free tier)

### Step 2: Configure the Cron Job
- **URL**: `https://yourdomain.com/api/cron/sync-emails`
- **Method**: POST
- **Headers**: 
  ```
  Authorization: Bearer ubuildit-email-sync-secret-2024
  Content-Type: application/json
  ```
- **Schedule**: Daily at your preferred time

---

## Method 4: Manual Scheduling Script

For development or self-hosted solutions:

### Step 1: Create sync script
Create `scripts/sync-emails.js`:

```javascript
#!/usr/bin/env node

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'ubuildit-email-sync-secret-2024';

async function syncEmails() {
  try {
    console.log('Starting email sync...');
    
    const response = await fetch(`${APP_URL}/api/cron/sync-emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Email sync completed:', result);
    } else {
      console.error('❌ Email sync failed:', result);
    }
  } catch (error) {
    console.error('❌ Error during email sync:', error);
  }
}

syncEmails();
```

### Step 2: Set up system cron
Add to your system's crontab (`crontab -e`):
```bash
# Daily at 8 AM
0 8 * * * /usr/bin/node /path/to/your/project/scripts/sync-emails.js
```

---

## Configuration Options

### Sync Frequency
You can adjust how often emails are synced by modifying the email account record:

```javascript
// In your OAuth callback or admin panel
await db.upsertEmailAccount({
  email_address: 'danielcase.info@gmail.com',
  sync_frequency: 60 // minutes between syncs
});
```

**Recommended frequencies:**
- **Development**: 60 minutes
- **Active projects**: 30 minutes  
- **Completed projects**: 240 minutes (4 hours)

### Search Query Customization
Edit the search query in `/api/cron/sync-emails/route.ts`:

```javascript
const searchQuery = '(from:(mike.trevino@ubuildit.com OR @ubuildit.com OR @kippflores.com OR @krystinik.com) OR "708 Purple Salvia Cove") newer_than:2d'
```

---

## Testing the Setup

### 1. Test the Endpoint
```bash
curl -X POST http://localhost:3000/api/cron/sync-emails \
  -H "Authorization: Bearer ubuildit-email-sync-secret-2024" \
  -H "Content-Type: application/json"
```

### 2. Check Logs
Monitor your application logs for:
- `Starting automated email sync...`
- `Found X emails to process`
- `Email sync completed. Processed X new emails`

### 3. Verify Database
Check your Supabase database:
- `email_accounts` table should have your account
- `emails` table should populate with new emails
- `projects` table should have your project record

### 4. Test Frontend
Visit `/emails` in your app - emails should load quickly from the database.

---

## Monitoring & Troubleshooting

### Common Issues

**1. Authentication Errors**
- Ensure OAuth tokens are stored in the database
- Check that `GMAIL_USER_EMAIL` matches the authenticated account
- Verify Google OAuth credentials are valid

**2. Missing Emails**
- Check the Gmail search query matches your expected senders
- Verify emails are within the time range (newer_than:2d)
- Ensure senders' domains are included in the search

**3. AI Summary Failures**
- Check `ANTHROPIC_API_KEY` is valid and has credits
- Monitor API rate limits
- Review error logs for specific Anthropic API errors

### Monitoring Tips

**Set up monitoring for:**
- Failed cron job executions
- Database connection errors
- Gmail API quota usage
- Anthropic Claude API usage and costs

**Log important metrics:**
- Number of emails synced per day
- AI summary generation time
- Database query performance

---

## Production Considerations

### Security
- Use environment-specific CRON_SECRET values
- ~~Ensure OAuth tokens are encrypted in the database~~ ✅ Implemented (AES-256-GCM via `token-encryption.ts`)
- Set up proper CORS and rate limiting

### Performance
- Consider implementing email archiving for old emails
- Add database indexes for faster email queries
- Monitor Supabase database size and performance

### Reliability
- Implement retry logic for failed syncs
- Add email deduplication to prevent duplicates
- Set up alerts for sync failures

### Scaling
- For multiple projects, modify the system to support project-specific syncing
- Consider using a message queue for large email volumes
- Implement batch processing for AI summarization

---

## Manual Sync Options

Users can still manually refresh emails by:
- Clicking "Refresh" in the email interface
- Adding `?refresh=true` to the `/api/emails/fetch` request
- Using the manual sync script

This provides flexibility while maintaining automated background syncing.
