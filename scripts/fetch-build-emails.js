require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function getEncryptionKey() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.CRON_SECRET || '';
  return crypto.createHash('sha256').update(secret).digest();
}

function decrypt(encrypted) {
  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

async function getFullMessage(gmail, id) {
  const d = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
  const headers = d.data.payload.headers || [];
  const getH = (name) => (headers.find(h => h.name === name) || {}).value || '';
  
  // Extract body text
  let body = '';
  function extractText(part) {
    if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      body += Buffer.from(part.body.data, 'base64').toString('utf8');
    }
    if (part.parts) part.parts.forEach(extractText);
  }
  if (d.data.payload) extractText(d.data.payload);
  
  return {
    id,
    subject: getH('Subject'),
    from: getH('From'),
    to: getH('To'),
    date: getH('Date'),
    body: body.substring(0, 2000)
  };
}

async function run() {
  const { data: accounts } = await supabase.from('email_accounts').select('*').limit(1);
  if (!accounts || accounts.length === 0) { console.error('No email accounts'); return; }
  
  const account = accounts[0];
  const tokens = account.oauth_tokens._encrypted ? decrypt(account.oauth_tokens) : account.oauth_tokens;
  console.error('Tokens OK. refresh_token present:', !!tokens.refresh_token);
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials(tokens);
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // First just list build emails
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'newer_than:30d (build OR construction OR permit OR UBuildIt OR bid OR loan OR financing OR cabinet OR survey OR engineer OR architect OR grading OR septic OR "liberty hill" OR "purple salvia" OR "case home" OR WCG OR "texas home consulting" OR plumber OR electrician OR HVAC OR foundation OR framing OR concrete OR roofing OR drywall OR flooring OR countertop OR excavation OR "lot prep" OR contractor OR subcontractor OR "building team" OR blueprint OR plans OR inspection OR "draw request")',
    maxResults: 50
  });
  
  const messages = res.data.messages || [];
  console.log('Found ' + messages.length + ' build-related emails in last 30 days');
  
  // Get full details for build-relevant ones
  const emailData = [];
  for (const msg of messages) {
    try {
      const email = await getFullMessage(gmail, msg.id);
      emailData.push(email);
      console.log('  ' + email.date.substring(0,16) + ' | ' + email.from.substring(0,35) + ' | ' + email.subject.substring(0,60));
    } catch (e) {
      console.error('  Error fetching ' + msg.id + ': ' + e.message);
    }
  }
  
  // Output full details as JSON
  console.log('\n\n=== FULL EMAIL DATA ===');
  console.log(JSON.stringify(emailData, null, 2));
}
run().catch(e => { 
  console.error('FATAL:', e.message); 
  if (e.response) console.error(e.response.status, JSON.stringify(e.response.data).substring(0,300)); 
});
