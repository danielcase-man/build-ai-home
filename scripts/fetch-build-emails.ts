import { getAuthenticatedGmailService } from '../src/lib/gmail-auth';

async function run() {
  console.error('Starting...');
  try {
    const gmail = await getAuthenticatedGmailService();
    if (!gmail) throw new Error('Gmail auth failed');
    console.error('Gmail auth OK');

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'newer_than:60d',
      maxResults: 30
    });
    
    const messages = res.data.messages || [];
    console.log('Found: ' + messages.length + ' emails');
    
    for (const msg of messages.slice(0, 20)) {
      const d = await gmail.users.messages.get({ 
        userId: 'me', 
        id: msg.id!, 
        format: 'metadata', 
        metadataHeaders: ['Subject', 'From', 'Date'] 
      });
      const headers: any[] = d.data.payload?.headers || [];
      const subj = headers.find(x => x.name === 'Subject')?.value || '';
      const from = headers.find(x => x.name === 'From')?.value || '';
      const date = headers.find(x => x.name === 'Date')?.value || '';
      console.log(`${date} | ${from.substring(0,40)} | ${subj.substring(0,70)}`);
    }
  } catch (err: any) {
    console.error('ERROR:', err.message);
    if (err.response?.data) console.error('Response data:', JSON.stringify(err.response.data));
  }
}
run();
