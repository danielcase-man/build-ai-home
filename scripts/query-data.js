const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://gyhrvtwtptcxedhokplv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aHJ2dHd0cHRjeGVkaG9rcGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc3MzY0OSwiZXhwIjoyMDcwMzQ5NjQ5fQ.DoT3XmphGAOYHAfhjkgC9-g9pyU7s-jBRjE1flJ3KLY');
async function run() {
  // Tasks
  const { data: tasks } = await s.from('tasks').select('id, title, status, due_date, priority, jobtread_id, notes').order('due_date', { ascending: true });
  console.log('=== TASKS (' + tasks.length + ') ===');
  const byStatus = {};
  tasks.forEach(t => { byStatus[t.status] = (byStatus[t.status]||0) + 1; });
  console.log('By status:', JSON.stringify(byStatus));
  const withJT = tasks.filter(t => t.jobtread_id).length;
  console.log('With jobtread_id:', withJT, '| Without:', tasks.length - withJT);
  const pushable = tasks.filter(t => t.jobtread_id === null && t.status !== 'completed' && t.status !== 'cancelled');
  console.log('Pushable (no JT id, active):', pushable.length);
  pushable.slice(0, 15).forEach(t => console.log('  - ' + t.title + ' | ' + t.status + ' | ' + (t.due_date || 'no date')));
  if (pushable.length > 15) console.log('  ... and ' + (pushable.length - 15) + ' more');

  // Budget items
  const { data: budget } = await s.from('budget_items').select('id, category, subcategory, description, estimated_cost, actual_cost, source, jobtread_id').order('category');
  console.log('\n=== BUDGET ITEMS (' + budget.length + ') ===');
  const bySrc = {};
  budget.forEach(b => { bySrc[b.source||'null'] = (bySrc[b.source||'null']||0) + 1; });
  console.log('By source:', JSON.stringify(bySrc));
  const bjt = budget.filter(b => b.jobtread_id).length;
  console.log('With jobtread_id:', bjt, '| Without:', budget.length - bjt);
  const cats = {};
  budget.forEach(b => {
    if (cats[b.category] === undefined) cats[b.category] = { count: 0, total: 0 };
    cats[b.category].count++;
    cats[b.category].total += parseFloat(b.estimated_cost) || 0;
  });
  Object.entries(cats).sort((a,b) => b[1].total - a[1].total).forEach(([cat, v]) => {
    console.log('  ' + cat + ': ' + v.count + ' items, $' + Math.round(v.total).toLocaleString());
  });

  // Show pushable budget items (no JT id, manual source)
  const pushableBudget = budget.filter(b => b.jobtread_id === null && (b.source === null || b.source === 'manual'));
  console.log('Pushable budget items:', pushableBudget.length);

  // Bids
  const { data: bids } = await s.from('bids').select('id, vendor_name, category, total_amount, status, valid_until');
  console.log('\n=== BIDS (' + bids.length + ') ===');
  bids.forEach(b => console.log('  ' + b.vendor_name + ' | ' + b.category + ' | $' + (b.total_amount||0).toLocaleString() + ' | ' + b.status));

  // Contacts
  const { data: contacts } = await s.from('contacts').select('id, name, role, company, email, phone');
  console.log('\n=== CONTACTS (' + contacts.length + ') ===');
  contacts.forEach(c => console.log('  ' + c.name + ' | ' + (c.role||'') + ' | ' + (c.company||'') + ' | ' + (c.email||'')));

  // Milestones
  const { data: ms } = await s.from('milestones').select('id, name, status, target_date');
  console.log('\n=== MILESTONES (' + ms.length + ') ===');
  ms.forEach(m => console.log('  ' + m.name + ' | ' + m.status + ' | ' + (m.target_date||'no date')));

  // Latest project status
  const { data: ps } = await s.from('project_status').select('date, ai_summary').order('date', { ascending: false }).limit(1);
  if (ps && ps[0]) {
    console.log('\n=== LATEST STATUS (' + ps[0].date + ') ===');
    console.log(ps[0].ai_summary ? ps[0].ai_summary.substring(0, 400) : 'no summary');
  }
}
run().catch(console.error);
