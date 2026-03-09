const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: emails, count } = await sb.from('emails').select('id, subject, sender_email, received_date', { count: 'exact' }).order('received_date', { ascending: false }).limit(5);
  console.log('=== EMAILS ===');
  console.log('Total count:', count);
  if (emails && emails.length) {
    emails.forEach(e => console.log(' ', e.received_date, '|', e.sender_email, '|', e.subject));
  } else {
    console.log('  (none)');
  }

  const { data: contacts } = await sb.from('contacts').select('name, email, track_emails, role').order('name');
  console.log('\n=== CONTACTS ===');
  if (contacts && contacts.length) {
    contacts.forEach(c => console.log(c.track_emails ? '  TRACKED' : '         ', c.email || '(no email)', '-', c.name, '(' + c.role + ')'));
  } else {
    console.log('  (none)');
  }

  const { data: accounts } = await sb.from('email_accounts').select('email, last_sync, sync_frequency, oauth_tokens');
  console.log('\n=== EMAIL ACCOUNTS ===');
  if (accounts && accounts.length) {
    accounts.forEach(a => {
      const hasTokens = a.oauth_tokens != null;
      console.log(' ', a.email, '| last_sync:', a.last_sync, '| freq:', a.sync_frequency, '| has_tokens:', hasTokens);
    });
  } else {
    console.log('  (none)');
  }

  const { data: project } = await sb.from('projects').select('id, name').limit(1).single();
  console.log('\n=== PROJECT ===');
  console.log(' ', project ? project.id + ' - ' + project.name : '(none)');

  process.exit(0);
})();
