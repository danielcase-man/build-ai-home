require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getGmailClient() {
  // Fetch OAuth tokens from database
  const { data: accounts, error } = await supabase
    .from('email_accounts')
    .select('*')
    .limit(1)
    .single();

  if (error || !accounts) {
    throw new Error('No email account found in database. Please connect Gmail via the app first.');
  }

  const tokens = accounts.oauth_tokens;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials(tokens);

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

async function fetchArredondoEmails() {
  try {
    console.log('Connecting to Gmail...\n');
    const gmail = await getGmailClient();

    // Search for emails from Daniel Arredondo
    console.log('Searching for emails from Daniel Arredondo...\n');
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:arredondo',
      maxResults: 50
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      console.log('No emails found from Daniel Arredondo');
      return;
    }

    console.log(`Found ${response.data.messages.length} emails from Daniel Arredondo\n`);
    console.log('='.repeat(80));

    const emails = [];

    // Fetch details for each email
    for (const message of response.data.messages) {
      const details = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });

      const headers = details.data.payload.headers;
      const from = headers.find(h => h.name === 'From')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Extract body
      let body = '';
      if (details.data.payload.parts) {
        const textPart = details.data.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart && textPart.body.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      } else if (details.data.payload.body.data) {
        body = Buffer.from(details.data.payload.body.data, 'base64').toString('utf-8');
      }

      emails.push({
        id: message.id,
        from,
        subject,
        date,
        body
      });
    }

    // Sort by date (newest first)
    emails.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Display emails
    emails.forEach((email, index) => {
      console.log(`\n📧 EMAIL ${index + 1} of ${emails.length}`);
      console.log('-'.repeat(80));
      console.log(`From: ${email.from}`);
      console.log(`Date: ${email.date}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`\nBody:\n${email.body.substring(0, 500)}${email.body.length > 500 ? '...' : ''}`);
      console.log('='.repeat(80));
    });

    // Generate summary
    console.log('\n\n📋 SUMMARY OF COMMUNICATIONS WITH DANIEL ARREDONDO');
    console.log('='.repeat(80));
    console.log(`Total emails found: ${emails.length}`);
    console.log(`Date range: ${emails[emails.length - 1]?.date} to ${emails[0]?.date}`);
    console.log('\nKey topics discussed:');

    const subjects = emails.map(e => e.subject).filter(s => s);
    subjects.forEach((subject, i) => {
      console.log(`  ${i + 1}. ${subject}`);
    });

  } catch (error) {
    console.error('Error fetching emails:', error.message);
    if (error.code === 401) {
      console.error('\nOAuth token may be expired. Please reconnect Gmail via the app.');
    }
  }
}

fetchArredondoEmails();
