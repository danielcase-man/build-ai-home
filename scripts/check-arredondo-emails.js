require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkArredondoEmails() {
  try {
    // Search for emails from Daniel Arredondo
    const { data: emails, error } = await supabase
      .from('emails')
      .select('*')
      .or('sender_email.ilike.%arredondo%,sender_name.ilike.%arredondo%')
      .order('received_date', { ascending: false });

    if (error) {
      console.error('Error fetching emails:', error);
      return;
    }

    if (!emails || emails.length === 0) {
      console.log('No emails found from Daniel Arredondo');
      return;
    }

    console.log(`Found ${emails.length} emails from Daniel Arredondo:\n`);

    emails.forEach((email, index) => {
      console.log(`\n--- Email ${index + 1} ---`);
      console.log(`From: ${email.sender_name} <${email.sender_email}>`);
      console.log(`Date: ${email.received_date}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Body Preview: ${email.body?.substring(0, 200)}...`);
      if (email.ai_summary) {
        console.log(`AI Summary: ${email.ai_summary}`);
      }
    });

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkArredondoEmails();
