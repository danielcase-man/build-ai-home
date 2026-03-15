require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function getKey() { return crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY || '').digest(); }
function decrypt(enc) {
  const key = getKey();
  const iv = Buffer.from(enc.iv, 'hex');
  const tag = Buffer.from(enc.tag, 'hex');
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  let r = d.update(enc.data, 'hex', 'utf8');
  r += d.final('utf8');
  return JSON.parse(r);
}

async function run() {
  const { data } = await s.from('email_accounts').select('*').limit(1);
  const tokens = decrypt(data[0].oauth_tokens);
  console.log('Token keys:', Object.keys(tokens));
  console.log('Has access_token:', Boolean(tokens.access_token));
  console.log('Has refresh_token:', Boolean(tokens.refresh_token));
  console.log('Token type:', tokens.token_type);
  console.log('Expiry date:', tokens.expiry_date);
  if (tokens.access_token) console.log('Access token prefix:', tokens.access_token.substring(0, 30) + '...');
}
run().catch(e => console.error(e.message));
