require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // Latest project status (AI-generated summary)
  const { data: status } = await s.from('project_status')
    .select('date, ai_summary, hot_topics, action_items, recent_decisions, next_steps, open_questions, key_data_points')
    .order('date', { ascending: false }).limit(1);
  
  if (status && status[0]) {
    console.log('=== LATEST AI STATUS (' + status[0].date + ') ===');
    console.log(status[0].ai_summary || 'No summary');
    console.log('\nHOT TOPICS:', JSON.stringify(status[0].hot_topics, null, 2));
    console.log('\nACTION ITEMS:', JSON.stringify(status[0].action_items, null, 2));
    console.log('\nNEXT STEPS:', JSON.stringify(status[0].next_steps, null, 2));
    console.log('\nOPEN QUESTIONS:', JSON.stringify(status[0].open_questions, null, 2));
  }
  
  // Active tasks (not completed/cancelled)
  const { data: tasks } = await s.from('tasks')
    .select('title, status, priority, due_date, notes')
    .neq('status', 'completed').neq('status', 'cancelled')
    .order('priority', { ascending: true }).limit(20);
  console.log('\n=== ACTIVE TASKS (' + (tasks?.length || 0) + ') ===');
  (tasks || []).forEach(t => console.log('  [' + t.priority + '] ' + t.title + ' (' + t.status + ')'));
  
  // Milestones
  const { data: ms } = await s.from('milestones')
    .select('name, status, target_date').order('created_at');
  console.log('\n=== MILESTONES (' + (ms?.length || 0) + ') ===');
  (ms || []).forEach(m => console.log('  ' + m.status + ' | ' + m.name + ' | ' + (m.target_date || 'no date')));
  
  // Planning steps
  const { data: steps } = await s.from('planning_phase_steps')
    .select('step_number, name, status').order('step_number');
  console.log('\n=== PLANNING STEPS ===');
  (steps || []).forEach(s => console.log('  Step ' + s.step_number + ': ' + s.name + ' [' + s.status + ']'));
  
  // Bids summary
  const { data: bids } = await s.from('bids')
    .select('vendor_name, category, total_amount, status').order('category');
  console.log('\n=== BIDS (' + (bids?.length || 0) + ') ===');
  const selected = (bids || []).filter(b => b.status === 'selected');
  const pending = (bids || []).filter(b => b.status === 'pending');
  console.log('Selected: ' + selected.length + ', Pending: ' + pending.length);
  selected.forEach(b => console.log('  SELECTED: ' + b.vendor_name + ' - ' + b.category + ' $' + (b.total_amount || 0).toLocaleString()));
  pending.forEach(b => console.log('  PENDING: ' + b.vendor_name + ' - ' + b.category + ' $' + (b.total_amount || 0).toLocaleString()));
  
  // Budget summary
  const { data: budget } = await s.from('budget_items')
    .select('category, estimated_cost').order('category');
  let totalBudget = 0;
  const cats = {};
  (budget || []).forEach(b => {
    const cost = parseFloat(b.estimated_cost) || 0;
    totalBudget += cost;
    if (!cats[b.category]) cats[b.category] = 0;
    cats[b.category] += cost;
  });
  console.log('\n=== BUDGET SUMMARY ===');
  console.log('Total estimated: $' + Math.round(totalBudget).toLocaleString());
  Object.entries(cats).sort((a,b) => b[1] - a[1]).slice(0, 10).forEach(([cat, val]) => {
    console.log('  ' + cat + ': $' + Math.round(val).toLocaleString());
  });
  
  // Key contacts
  const { data: contacts } = await s.from('contacts')
    .select('name, role, company, email, phone').order('company');
  console.log('\n=== KEY CONTACTS (' + (contacts?.length || 0) + ') ===');
  (contacts || []).forEach(c => console.log('  ' + c.name + ' | ' + (c.role || '') + ' | ' + (c.company || '') + ' | ' + (c.email || '')));
  
  // Recent communications
  const { data: comms } = await s.from('communications')
    .select('type, summary, contact_name, date')
    .order('date', { ascending: false }).limit(10);
  console.log('\n=== RECENT COMMUNICATIONS (' + (comms?.length || 0) + ') ===');
  (comms || []).forEach(c => console.log('  ' + (c.date || '') + ' | ' + c.type + ' | ' + (c.contact_name || '') + ' | ' + (c.summary || '').substring(0, 100)));
}
run().catch(console.error);
