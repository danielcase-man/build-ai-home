const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gyhrvtwtptcxedhokplv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5aHJ2dHd0cHRjeGVkaG9rcGx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc3MzY0OSwiZXhwIjoyMDcwMzQ5NjQ5fQ.DoT3XmphGAOYHAfhjkgC9-g9pyU7s-jBRjE1flJ3KLY'
);

async function run() {
  const { data: projects } = await supabase.from('projects').select('id').limit(1);
  const pid = projects[0].id;

  const [milestones, steps, vendors, bids, selections, docs, contacts, permits, loans] = await Promise.all([
    supabase.from('milestones').select('id, name, status, notes').eq('project_id', pid).then(r => r.data || []),
    supabase.from('planning_phase_steps').select('id, step_number, name, status, notes').eq('project_id', pid).order('step_number').then(r => r.data || []),
    supabase.from('vendors').select('id, company_name, category, status, notes').eq('project_id', pid).then(r => r.data || []),
    supabase.from('bids').select('id, vendor_name, category, status').eq('project_id', pid).then(r => r.data || []),
    supabase.from('selections').select('id, category, status').eq('project_id', pid).then(r => r.data || []),
    supabase.from('documents').select('id, name, category').eq('project_id', pid).then(r => r.data || []),
    supabase.from('contacts').select('id, name, company, role').eq('project_id', pid).then(r => r.data || []),
    supabase.from('permits').select('id, type, status').eq('project_id', pid).then(r => r.data || []),
    supabase.from('construction_loans').select('application_status').eq('project_id', pid).eq('is_active', true).limit(1).then(r => r.data || []),
  ]);

  const loan = loans.length > 0 ? loans[0] : null;

  function hasBids(cats, statuses) {
    const vs = statuses || ['pending','under_review','selected'];
    return bids.some(b => cats.some(c => b.category.toLowerCase().includes(c.toLowerCase())) && vs.includes(b.status));
  }
  function hasSelectedBids(cats) { return hasBids(cats, ['selected']); }
  function hasVendor(kws, sts) {
    return vendors.some(v => kws.some(k => (v.category||'').toLowerCase().includes(k.toLowerCase())) && (!sts || sts.includes(v.status||'')));
  }
  function hasDocs(kws) {
    return docs.some(d => kws.some(k => (d.name||'').toLowerCase().includes(k.toLowerCase()) || (d.category||'').toLowerCase().includes(k.toLowerCase())));
  }

  const changes = [];
  const MS_ORDER = ['pending','in_progress','completed'];
  const canPromote = (cur, prop) => MS_ORDER.indexOf(prop) > MS_ORDER.indexOf(cur);
  const PLAN_ORDER = ['not_started','in_progress','completed'];
  const canPromoteStep = (cur, prop) => PLAN_ORDER.indexOf(prop) > PLAN_ORDER.indexOf(cur);
  const VENDOR_ORDER = ['potential','approved','active','completed'];
  const canPromoteV = (cur, prop) => VENDOR_ORDER.indexOf(prop) > VENDOR_ORDER.indexOf(cur||'potential');

  console.log('========================================');
  console.log('  RECONCILER DRY RUN - PROPOSED CHANGES');
  console.log('========================================\n');
  console.log('--- MILESTONES ---');

  for (const ms of milestones) {
    let rec = null;
    const n = ms.name.toLowerCase();

    if (n.includes('pre-construction') || n.includes('pre construction')) {
      if (hasSelectedBids(['Site Work','Well & Septic','Civil Engineering','Surveying','Foundation Engineering']))
        rec = { status: 'in_progress', reason: 'Selected bids in pre-construction trades' };
      else if (hasBids(['Site Work','Well & Septic','Civil Engineering','Surveying','Foundation Engineering']))
        rec = { status: 'in_progress', reason: 'Bids received for pre-construction trades' };
    } else if (n.includes('design final')) {
      const archDone = hasVendor(['architect','architecture'], ['completed']);
      const plans = hasDocs(['architectural_plans','construction drawings','floor plan']);
      if (archDone && plans) rec = { status: 'completed', reason: 'Architect completed + plans docs exist' };
      else if (hasVendor(['architect','architecture'])) rec = { status: 'in_progress', reason: 'Architect vendor engaged' };
    } else if (n.includes('permit')) {
      if (permits.length > 0 && permits.some(p => ['submitted','in_review','in_progress'].includes(p.status)))
        rec = { status: 'in_progress', reason: 'Permit applications in progress' };
    } else if (n.includes('procurement') || n.includes('bidding')) {
      const sel = bids.filter(b => b.status==='selected').length;
      const rev = bids.filter(b => b.status==='under_review').length;
      if (sel > 0 || rev > 0) rec = { status: 'in_progress', reason: `${sel} selected, ${rev} under review of ${bids.length} total bids` };
    } else if (n.includes('interior finish')) {
      const intCats = ['Doors & Trim','Painting','Cabinetry','Countertops','Tile','Flooring'];
      const matched = intCats.filter(c => bids.some(b => b.category.toLowerCase().includes(c.toLowerCase()) && b.status==='selected'));
      if (matched.length > 0) rec = { status: 'in_progress', reason: `Interior finish bids selected: ${matched.join(', ')}` };
    } else if (n.includes('final mechanical')) {
      const confirmedSel = ['plumbing','lighting','appliance'].filter(c => selections.some(s => s.category===c && s.status==='selected'));
      if (confirmedSel.length > 0) rec = { status: 'in_progress', reason: `Confirmed selections in: ${confirmedSel.join(', ')}` };
    }

    if (rec && canPromote(ms.status, rec.status)) {
      changes.push({ type: 'milestone', name: ms.name, from: ms.status, to: rec.status, reason: rec.reason });
      console.log(`  >> ${ms.name}: ${ms.status} -> ${rec.status}`);
      console.log(`     Reason: ${rec.reason}`);
    } else {
      console.log(`  -- ${ms.name}: ${ms.status} (no change)`);
    }
  }

  console.log('\n--- PLANNING STEPS ---');
  for (const step of steps) {
    let rec = null;
    if (step.step_number === 1) {
      if (contacts.some(c => (c.company||'').toLowerCase().includes('ubuildit') || (c.role||'').toLowerCase().includes('consultant')))
        rec = { status: 'completed', reason: 'UBuildIt consultant contact established' };
    } else if (step.step_number === 2) {
      if (hasDocs(['survey','soil','topographic','plat','lot analysis','site visit']))
        rec = { status: 'completed', reason: 'Site/survey documents exist' };
    } else if (step.step_number === 3) {
      const archDone = hasVendor(['architect','architecture'], ['completed']);
      const plans = hasDocs(['architectural_plans','construction drawings','floor plan']);
      if (archDone && plans) rec = { status: 'completed', reason: 'Architect completed + plans uploaded' };
      else if (hasVendor(['architect','architecture'])) rec = { status: 'in_progress', reason: 'Architect vendor engaged' };
    } else if (step.step_number === 4) {
      if (bids.length > 0) {
        const selCount = bids.filter(b => b.status==='selected').length;
        const cats = new Set(bids.map(b => b.category));
        rec = { status: 'in_progress', reason: `${bids.length} bids across ${cats.size} categories (${selCount} selected)` };
      }
    } else if (step.step_number === 5) {
      if (loan) {
        if (['approved','funded'].includes(loan.application_status))
          rec = { status: 'completed', reason: `Loan ${loan.application_status}` };
        else if (!['not_started'].includes(loan.application_status))
          rec = { status: 'in_progress', reason: `Loan status: ${loan.application_status}` };
      }
    }

    if (rec && canPromoteStep(step.status, rec.status)) {
      changes.push({ type: 'planning_step', name: `Step ${step.step_number}`, from: step.status, to: rec.status, reason: rec.reason });
      console.log(`  >> Step ${step.step_number} (${step.name || 'unnamed'}): ${step.status} -> ${rec.status}`);
      console.log(`     Reason: ${rec.reason}`);
    } else {
      console.log(`  -- Step ${step.step_number} (${step.name || 'unnamed'}): ${step.status} (no change)`);
    }
  }

  console.log('\n--- VENDORS ---');
  for (const v of vendors) {
    const vBids = bids.filter(b =>
      b.vendor_name.toLowerCase().includes(v.company_name.toLowerCase()) ||
      v.company_name.toLowerCase().includes(b.vendor_name.toLowerCase())
    );
    const hasSelected = vBids.some(b => b.status === 'selected');

    if (hasSelected && (v.status === 'potential' || v.status === null)) {
      const cats = vBids.filter(b => b.status==='selected').map(b => b.category).join(', ');
      changes.push({ type: 'vendor', name: v.company_name, from: v.status, to: 'active', reason: `Selected bid: ${cats}` });
      console.log(`  >> ${v.company_name}: ${v.status} -> active`);
      console.log(`     Reason: Selected bid in ${cats}`);
    }
  }

  console.log('\n========================================');
  console.log(`  TOTAL: ${changes.length} proposed changes`);
  console.log('========================================');
  changes.forEach(c => console.log(`  ${c.type.padEnd(14)} | ${c.name.padEnd(30)} | ${c.from} -> ${c.to}`));
}

run().catch(e => console.error(e));
