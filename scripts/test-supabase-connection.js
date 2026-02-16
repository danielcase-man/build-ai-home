require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? 'present' : 'missing');

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    console.log('\nAttempting to fetch email accounts...');
    const { data, error } = await supabase
      .from('email_accounts')
      .select('id, email, provider')
      .limit(1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('Success! Found account:', data);
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

test();
