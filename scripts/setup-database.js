/**
 * Database Setup Script
 * Applies schema, fixes RLS policies, creates bids tables, inserts seed data
 *
 * Usage: node scripts/setup-database.js
 */

const { Client } = require('pg')

const CONNECTION_STRING = 'postgresql://postgres.gyhrvtwtptcxedhokplv:IloveD%40lache1@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

async function run() {
  const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected to Supabase')

  // Step 1: Extensions
  console.log('\n--- Step 1: Extensions ---')
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)
  await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`)
  console.log('Extensions created')

  // Step 2: Core tables
  console.log('\n--- Step 2: Core tables ---')

  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      address TEXT NOT NULL,
      lot_info TEXT,
      square_footage INTEGER,
      style VARCHAR(100),
      phase VARCHAR(20) CHECK (phase IN ('planning', 'construction', 'completed')) DEFAULT 'planning',
      current_step INTEGER DEFAULT 1,
      start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      target_completion DATE,
      budget_total DECIMAL(12, 2),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  projects')

  await client.query(`
    CREATE TABLE IF NOT EXISTS planning_phase_steps (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      step_name VARCHAR(100) NOT NULL,
      status VARCHAR(20) CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
      start_date DATE,
      completion_date DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      UNIQUE(project_id, step_number)
    );
  `)
  console.log('  planning_phase_steps')

  await client.query(`
    CREATE TABLE IF NOT EXISTS milestones (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      target_date DATE,
      completed_date DATE,
      status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed')) DEFAULT 'pending',
      dependencies JSONB,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  milestones')

  await client.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      type VARCHAR(50) CHECK (type IN ('consultant', 'vendor', 'contractor', 'architect', 'engineer', 'supplier', 'other')),
      company VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      role VARCHAR(100),
      is_ubuildit_team BOOLEAN DEFAULT FALSE,
      track_emails BOOLEAN DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  contacts')

  await client.query(`
    CREATE TABLE IF NOT EXISTS budget_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      category VARCHAR(100) NOT NULL,
      subcategory VARCHAR(100),
      description TEXT NOT NULL,
      estimated_cost DECIMAL(12, 2),
      actual_cost DECIMAL(12, 2),
      vendor_id UUID,
      status VARCHAR(20) CHECK (status IN ('estimated', 'bid_received', 'approved', 'paid')) DEFAULT 'estimated',
      approval_date DATE,
      payment_date DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  budget_items')

  await client.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      category VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      file_url TEXT NOT NULL,
      file_size INTEGER,
      file_type VARCHAR(50),
      version INTEGER DEFAULT 1,
      upload_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      tags JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  documents')

  await client.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      due_date DATE,
      priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
      assigned_to UUID REFERENCES contacts(id) ON DELETE SET NULL,
      status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
      completed_date DATE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  tasks')

  await client.query(`
    CREATE TABLE IF NOT EXISTS permits (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      type VARCHAR(100) NOT NULL,
      permit_number VARCHAR(100),
      application_date DATE,
      approval_date DATE,
      expiration_date DATE,
      status VARCHAR(20) CHECK (status IN ('not_started', 'preparing', 'submitted', 'approved', 'rejected', 'expired')) DEFAULT 'not_started',
      inspection_dates JSONB,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  permits')

  await client.query(`
    CREATE TABLE IF NOT EXISTS email_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID,
      email_address VARCHAR(255) NOT NULL UNIQUE,
      provider VARCHAR(50) DEFAULT 'gmail',
      oauth_tokens JSONB,
      sync_enabled BOOLEAN DEFAULT TRUE,
      last_sync TIMESTAMP WITH TIME ZONE,
      sync_frequency INTEGER DEFAULT 30,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  email_accounts')

  await client.query(`
    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
      message_id VARCHAR(255) UNIQUE,
      thread_id VARCHAR(255),
      sender_email VARCHAR(255),
      sender_name VARCHAR(255),
      recipients JSONB,
      subject TEXT,
      body_text TEXT,
      body_html TEXT,
      received_date TIMESTAMP WITH TIME ZONE,
      is_read BOOLEAN DEFAULT FALSE,
      is_flagged BOOLEAN DEFAULT FALSE,
      category VARCHAR(50),
      urgency_level VARCHAR(20) CHECK (urgency_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
      has_attachments BOOLEAN DEFAULT FALSE,
      attachment_urls JSONB,
      ai_summary TEXT,
      action_items JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  emails')

  await client.query(`
    CREATE TABLE IF NOT EXISTS email_attachments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
      filename VARCHAR(255),
      file_type VARCHAR(50),
      file_size INTEGER,
      storage_url TEXT,
      is_document BOOLEAN DEFAULT FALSE,
      is_image BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  email_attachments')

  await client.query(`
    CREATE TABLE IF NOT EXISTS communications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
      date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      type VARCHAR(50) CHECK (type IN ('email', 'phone', 'meeting', 'text', 'other')),
      subject TEXT,
      summary TEXT,
      action_items JSONB,
      decisions JSONB,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  communications')

  await client.query(`
    CREATE TABLE IF NOT EXISTS project_status (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      phase VARCHAR(20),
      current_step INTEGER,
      progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
      hot_topics JSONB,
      action_items JSONB,
      recent_decisions JSONB,
      budget_status VARCHAR(50),
      budget_used DECIMAL(12, 2),
      ai_summary TEXT,
      last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      UNIQUE(project_id, date)
    );
  `)
  console.log('  project_status')

  await client.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      company_name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      status VARCHAR(20) CHECK (status IN ('potential', 'approved', 'active', 'completed')) DEFAULT 'potential',
      primary_contact UUID REFERENCES contacts(id) ON DELETE SET NULL,
      email_domains JSONB,
      auto_track_emails BOOLEAN DEFAULT FALSE,
      notes TEXT,
      added_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  vendors')

  await client.query(`
    CREATE TABLE IF NOT EXISTS notification_queue (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      type VARCHAR(50),
      priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
      title VARCHAR(255),
      message TEXT,
      email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      sent_at TIMESTAMP WITH TIME ZONE,
      read_at TIMESTAMP WITH TIME ZONE,
      channel VARCHAR(50) CHECK (channel IN ('in_app', 'push', 'email', 'sms'))
    );
  `)
  console.log('  notification_queue')

  // Step 3: Indexes
  console.log('\n--- Step 3: Indexes ---')
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_projects_phase ON projects(phase)',
    'CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status)',
    'CREATE INDEX IF NOT EXISTS idx_budget_items_project_id ON budget_items(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_budget_items_category ON budget_items(category)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_project_id ON contacts(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type)',
    'CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)',
    'CREATE INDEX IF NOT EXISTS idx_permits_project_id ON permits(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_emails_project_id ON emails(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_emails_sender_email ON emails(sender_email)',
    'CREATE INDEX IF NOT EXISTS idx_emails_received_date ON emails(received_date)',
    'CREATE INDEX IF NOT EXISTS idx_project_status_project_date ON project_status(project_id, date)',
  ]
  for (const idx of indexes) {
    await client.query(idx)
  }
  console.log(`Created ${indexes.length} indexes`)

  // Step 4: Trigger function
  console.log('\n--- Step 4: Trigger function ---')
  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = TIMEZONE('utc', NOW());
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `)
  console.log('Created update_updated_at_column function')

  // Step 5: Triggers (drop if exist to avoid errors)
  console.log('\n--- Step 5: Triggers ---')
  const triggerTables = [
    'projects', 'planning_phase_steps', 'milestones', 'budget_items',
    'contacts', 'documents', 'tasks', 'permits', 'emails',
    'communications', 'vendors'
  ]
  for (const table of triggerTables) {
    await client.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`)
    await client.query(`
      CREATE TRIGGER update_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `)
  }
  console.log(`Created ${triggerTables.length} triggers`)

  // Step 6: RLS - Enable RLS but with OPEN policies (anon key access)
  console.log('\n--- Step 6: RLS policies (open for anon key) ---')
  const rlsTables = [
    'projects', 'planning_phase_steps', 'milestones', 'budget_items',
    'contacts', 'documents', 'tasks', 'permits', 'email_accounts',
    'emails', 'email_attachments', 'communications', 'project_status',
    'vendors', 'notification_queue'
  ]
  for (const table of rlsTables) {
    await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
    // Drop old restrictive policy if exists
    await client.query(`DROP POLICY IF EXISTS "Users can view their own projects" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view project data" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view milestones" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view budget items" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view contacts" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view documents" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view tasks" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view permits" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view email accounts" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view emails" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view email attachments" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view communications" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view project status" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view vendors" ON ${table}`)
    await client.query(`DROP POLICY IF EXISTS "Users can view notifications" ON ${table}`)
    // Drop the new open policy too (idempotent)
    await client.query(`DROP POLICY IF EXISTS "Allow all access" ON ${table}`)
    // Create open policy for anon key
    await client.query(`CREATE POLICY "Allow all access" ON ${table} FOR ALL USING (true) WITH CHECK (true)`)
  }
  console.log(`Configured open RLS on ${rlsTables.length} tables`)

  // Step 7: Bids tables
  console.log('\n--- Step 7: Bids tables ---')
  await client.query(`
    CREATE TABLE IF NOT EXISTS bids (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
      vendor_name VARCHAR(255) NOT NULL,
      vendor_contact VARCHAR(255),
      vendor_email VARCHAR(255),
      vendor_phone VARCHAR(50),
      category VARCHAR(100) NOT NULL,
      subcategory VARCHAR(100),
      description TEXT NOT NULL,
      total_amount DECIMAL(12, 2) NOT NULL,
      line_items JSONB,
      scope_of_work TEXT,
      inclusions JSONB,
      exclusions JSONB,
      payment_terms TEXT,
      warranty_terms TEXT,
      estimated_duration VARCHAR(100),
      lead_time_weeks INTEGER,
      valid_until DATE,
      status VARCHAR(20) CHECK (status IN ('pending', 'under_review', 'selected', 'rejected', 'expired')) DEFAULT 'pending',
      selection_notes TEXT,
      selected_date DATE,
      source VARCHAR(50) DEFAULT 'email',
      email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
      source_document TEXT,
      ai_extracted BOOLEAN DEFAULT FALSE,
      ai_confidence DECIMAL(3, 2),
      ai_extraction_notes TEXT,
      needs_review BOOLEAN DEFAULT TRUE,
      pros TEXT,
      cons TEXT,
      internal_notes TEXT,
      comparison_rank INTEGER,
      bid_date DATE NOT NULL DEFAULT CURRENT_DATE,
      received_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  bids')

  await client.query(`
    CREATE TABLE IF NOT EXISTS bid_comparisons (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      category VARCHAR(100) NOT NULL,
      description TEXT,
      bid_ids UUID[] NOT NULL,
      evaluation_criteria JSONB,
      selected_bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
      selection_date DATE,
      selection_rationale TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  bid_comparisons')

  await client.query(`
    CREATE TABLE IF NOT EXISTS bid_attachments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      file_type VARCHAR(50),
      file_size INTEGER,
      storage_url TEXT NOT NULL,
      attachment_type VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );
  `)
  console.log('  bid_attachments')

  // Bid indexes
  const bidIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_bids_project ON bids(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_bids_vendor ON bids(vendor_id)',
    'CREATE INDEX IF NOT EXISTS idx_bids_category ON bids(category)',
    'CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status)',
    'CREATE INDEX IF NOT EXISTS idx_bids_email ON bids(email_id)',
    'CREATE INDEX IF NOT EXISTS idx_bid_comparisons_project ON bid_comparisons(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_bid_comparisons_selected ON bid_comparisons(selected_bid_id)',
    'CREATE INDEX IF NOT EXISTS idx_bid_attachments_bid ON bid_attachments(bid_id)',
  ]
  for (const idx of bidIndexes) {
    await client.query(idx)
  }

  // Bid trigger
  await client.query(`DROP TRIGGER IF EXISTS update_bids_updated_at ON bids`)
  await client.query(`
    CREATE TRIGGER update_bids_updated_at
    BEFORE UPDATE ON bids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `)

  // RLS for bids tables
  for (const table of ['bids', 'bid_comparisons', 'bid_attachments']) {
    await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`)
    await client.query(`DROP POLICY IF EXISTS "Allow all access" ON ${table}`)
    await client.query(`CREATE POLICY "Allow all access" ON ${table} FOR ALL USING (true) WITH CHECK (true)`)
  }
  console.log('  indexes, triggers, RLS for bids')

  // Bid functions
  await client.query(`
    CREATE OR REPLACE FUNCTION finalize_bid_to_budget(bid_uuid UUID)
    RETURNS UUID AS $$
    DECLARE
      new_budget_item_id UUID;
      bid_record RECORD;
    BEGIN
      SELECT * INTO bid_record FROM bids WHERE id = bid_uuid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Bid not found: %', bid_uuid;
      END IF;
      IF bid_record.status != 'selected' THEN
        RAISE EXCEPTION 'Bid must be selected before finalizing: %', bid_uuid;
      END IF;
      INSERT INTO budget_items (project_id, category, subcategory, description, estimated_cost, vendor_id, status, approval_date, notes)
      VALUES (bid_record.project_id, bid_record.category, bid_record.subcategory,
              bid_record.description || ' - ' || bid_record.vendor_name, bid_record.total_amount,
              bid_record.vendor_id, 'approved', CURRENT_DATE,
              'Finalized from bid #' || bid_record.id || '. ' || COALESCE(bid_record.selection_notes, ''))
      RETURNING id INTO new_budget_item_id;
      UPDATE bids SET status = 'selected', selected_date = CURRENT_DATE,
        internal_notes = COALESCE(internal_notes, '') || ' [Finalized to budget_item: ' || new_budget_item_id || ']'
      WHERE id = bid_uuid;
      RETURN new_budget_item_id;
    END;
    $$ LANGUAGE plpgsql;
  `)

  await client.query(`
    CREATE OR REPLACE FUNCTION reject_competing_bids(selected_bid_uuid UUID)
    RETURNS INTEGER AS $$
    DECLARE
      rejected_count INTEGER;
      bid_record RECORD;
    BEGIN
      SELECT * INTO bid_record FROM bids WHERE id = selected_bid_uuid;
      UPDATE bids SET status = 'rejected', selection_notes = 'Alternative bid selected'
      WHERE project_id = bid_record.project_id
        AND category = bid_record.category
        AND id != selected_bid_uuid
        AND status IN ('pending', 'under_review');
      GET DIAGNOSTICS rejected_count = ROW_COUNT;
      RETURN rejected_count;
    END;
    $$ LANGUAGE plpgsql;
  `)
  console.log('  bid functions')

  // Bid views
  await client.query(`DROP VIEW IF EXISTS pending_bids_summary`)
  await client.query(`
    CREATE VIEW pending_bids_summary AS
    SELECT b.id, b.project_id, b.category, b.vendor_name, b.total_amount,
      b.status, b.needs_review, b.ai_extracted, b.received_date, b.valid_until,
      p.name as project_name,
      COUNT(DISTINCT bc.id) as competing_bids_count
    FROM bids b
    LEFT JOIN projects p ON b.project_id = p.id
    LEFT JOIN bids bc ON b.category = bc.category AND b.project_id = bc.project_id AND bc.id != b.id AND bc.status != 'rejected'
    WHERE b.status IN ('pending', 'under_review')
    GROUP BY b.id, p.name
  `)

  await client.query(`DROP VIEW IF EXISTS bids_by_category`)
  await client.query(`
    CREATE VIEW bids_by_category AS
    SELECT category, project_id,
      COUNT(*) as bid_count,
      MIN(total_amount) as lowest_bid,
      MAX(total_amount) as highest_bid,
      AVG(total_amount) as average_bid,
      COUNT(CASE WHEN status = 'selected' THEN 1 END) as selected_count,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
    FROM bids
    GROUP BY category, project_id
  `)
  console.log('  bid views')

  // Step 8: Seed data
  console.log('\n--- Step 8: Seed data ---')

  // Insert the project
  const projectResult = await client.query(`
    INSERT INTO projects (name, address, lot_info, square_footage, style, phase, current_step, start_date, target_completion, budget_total)
    VALUES (
      'Case Residence - French Country Estate',
      '708 Purple Salvia Cove, Liberty Hill, TX 78642',
      'Lot in Santa Rita Ranch subdivision',
      7526,
      'French Country Estate',
      'planning',
      2,
      '2025-01-15',
      '2026-06-30',
      850000.00
    )
    RETURNING id
  `)
  const projectId = projectResult.rows[0].id
  console.log(`  Project created: ${projectId}`)

  // Planning phase steps (UBuildIt 6-step process)
  const planningSteps = [
    { step: 1, name: 'Initial Consultation & Lot Evaluation', status: 'completed', start: '2025-01-15', end: '2025-02-01' },
    { step: 2, name: 'Design & Architecture Plans', status: 'in_progress', start: '2025-02-01', end: null },
    { step: 3, name: 'Permits & Engineering', status: 'not_started', start: null, end: null },
    { step: 4, name: 'Vendor Selection & Bidding', status: 'not_started', start: null, end: null },
    { step: 5, name: 'Budget Finalization', status: 'not_started', start: null, end: null },
    { step: 6, name: 'Construction Kickoff', status: 'not_started', start: null, end: null },
  ]
  for (const step of planningSteps) {
    await client.query(`
      INSERT INTO planning_phase_steps (project_id, step_number, step_name, status, start_date, completion_date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [projectId, step.step, step.name, step.status, step.start, step.end])
  }
  console.log(`  ${planningSteps.length} planning steps`)

  // Key milestones
  const milestones = [
    { name: 'Land Purchase Closed', status: 'completed', target: '2025-01-10', completed: '2025-01-10', desc: 'Lot purchased in Santa Rita Ranch' },
    { name: 'UBuildIt Contract Signed', status: 'completed', target: '2025-01-15', completed: '2025-01-15', desc: 'Signed with UBuildIt Williamson Team' },
    { name: 'Architect Plans Complete', status: 'in_progress', target: '2025-03-15', completed: null, desc: 'Final architectural drawings and specs' },
    { name: 'Engineering Approval', status: 'pending', target: '2025-04-01', completed: null, desc: 'Structural engineering review and stamp' },
    { name: 'Building Permit Approved', status: 'pending', target: '2025-04-30', completed: null, desc: 'City of Liberty Hill building permit' },
    { name: 'Foundation Pour', status: 'pending', target: '2025-05-30', completed: null, desc: 'Foundation construction complete' },
    { name: 'Framing Complete', status: 'pending', target: '2025-07-30', completed: null, desc: 'All framing and roof structure' },
    { name: 'Rough-In Complete', status: 'pending', target: '2025-09-15', completed: null, desc: 'Electrical, plumbing, HVAC rough-in' },
    { name: 'Drywall & Interior', status: 'pending', target: '2025-11-01', completed: null, desc: 'Drywall, paint, trim, cabinets' },
    { name: 'Final Inspections', status: 'pending', target: '2026-05-15', completed: null, desc: 'All final inspections passed' },
    { name: 'Certificate of Occupancy', status: 'pending', target: '2026-06-01', completed: null, desc: 'CO issued, move-in ready' },
  ]
  for (const m of milestones) {
    await client.query(`
      INSERT INTO milestones (project_id, name, description, target_date, completed_date, status)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [projectId, m.name, m.desc, m.target, m.completed, m.status])
  }
  console.log(`  ${milestones.length} milestones`)

  // UBuildIt team contacts
  const contacts = [
    { type: 'consultant', company: 'UBuildIt Williamson', name: 'Randy Poston', email: 'Williamson.tx@ubuildit.com', phone: '(512) 828-3187', role: 'UBuildIt Consultant', ubuildit: true },
    { type: 'architect', company: null, name: 'Architect (TBD)', email: null, phone: null, role: 'Project Architect', ubuildit: false },
  ]
  for (const c of contacts) {
    await client.query(`
      INSERT INTO contacts (project_id, type, company, name, email, phone, role, is_ubuildit_team)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [projectId, c.type, c.company, c.name, c.email, c.phone, c.role, c.ubuildit])
  }
  console.log(`  ${contacts.length} contacts`)

  // Budget items (initial estimates)
  const budgetItems = [
    { cat: 'Land', desc: 'Lot purchase - 708 Purple Salvia Cove', est: 120000, status: 'paid' },
    { cat: 'Architecture', desc: 'Architectural plans and design', est: 25000, status: 'estimated' },
    { cat: 'Engineering', desc: 'Structural engineering', est: 8000, status: 'estimated' },
    { cat: 'Permits', desc: 'Building permits and fees', est: 15000, status: 'estimated' },
    { cat: 'Foundation', desc: 'Foundation and slab', est: 65000, status: 'estimated' },
    { cat: 'Framing', desc: 'Framing labor and materials', est: 95000, status: 'estimated' },
    { cat: 'Roofing', desc: 'Roof installation', est: 35000, status: 'estimated' },
    { cat: 'Electrical', desc: 'Electrical rough-in and finish', est: 32000, status: 'estimated' },
    { cat: 'Plumbing', desc: 'Plumbing rough-in and finish', est: 28000, status: 'estimated' },
    { cat: 'HVAC', desc: 'Heating and cooling systems', est: 35000, status: 'estimated' },
    { cat: 'Windows & Doors', desc: 'Windows and exterior doors', est: 55000, status: 'estimated' },
    { cat: 'Insulation', desc: 'Insulation and weatherization', est: 12000, status: 'estimated' },
    { cat: 'Drywall', desc: 'Drywall installation and finish', est: 28000, status: 'estimated' },
    { cat: 'Cabinets', desc: 'Kitchen and bath cabinets', est: 45000, status: 'estimated' },
    { cat: 'Countertops', desc: 'Kitchen and bath countertops', est: 20000, status: 'estimated' },
    { cat: 'Flooring', desc: 'All flooring materials and installation', est: 35000, status: 'estimated' },
    { cat: 'Paint', desc: 'Interior and exterior paint', est: 18000, status: 'estimated' },
    { cat: 'Appliances', desc: 'Kitchen appliances', est: 25000, status: 'estimated' },
    { cat: 'Landscaping', desc: 'Basic landscaping and irrigation', est: 20000, status: 'estimated' },
    { cat: 'Contingency', desc: 'Contingency reserve (10%)', est: 85000, status: 'estimated' },
  ]
  for (const b of budgetItems) {
    await client.query(`
      INSERT INTO budget_items (project_id, category, description, estimated_cost, status)
      VALUES ($1, $2, $3, $4, $5)
    `, [projectId, b.cat, b.desc, b.est, b.status])
  }
  console.log(`  ${budgetItems.length} budget items`)

  // Project status (today's snapshot)
  await client.query(`
    INSERT INTO project_status (project_id, date, phase, current_step, progress_percentage,
      hot_topics, action_items, recent_decisions, budget_status, budget_used, ai_summary)
    VALUES ($1, CURRENT_DATE, 'planning', 2, 15,
      $2::jsonb, $3::jsonb, $4::jsonb,
      'On Track', 120000.00,
      'The Case Residence project is in the early planning phase. The lot has been purchased at 708 Purple Salvia Cove in Santa Rita Ranch, Liberty Hill. The UBuildIt consultation is complete and architectural design is underway. The project is a ~7,526 sq ft French Country Estate with an estimated budget of $850,000. Key next steps include finalizing architectural plans and beginning the engineering review process.')
  `, [
    projectId,
    JSON.stringify([
      { topic: 'Architectural plans in progress - awaiting final design review', priority: 'high', importance: 'critical' },
      { topic: 'Need to select structural engineer for plan review', priority: 'medium', importance: 'important' },
      { topic: 'HOA approval process to be initiated after plans finalized', priority: 'medium', importance: 'important' },
      { topic: 'Begin vendor outreach for early-stage bids (foundation, framing)', priority: 'low', importance: 'info' },
    ]),
    JSON.stringify([
      { action: 'Schedule design review meeting with architect', status: 'pending', due: '2025-03-01' },
      { action: 'Research and contact structural engineers', status: 'pending', due: '2025-03-15' },
      { action: 'Compile HOA submission package requirements', status: 'pending', due: '2025-03-10' },
      { action: 'Contact UBuildIt recommended vendors for initial bids', status: 'pending', due: '2025-04-01' },
    ]),
    JSON.stringify([
      { decision: 'Selected lot 708 Purple Salvia Cove in Santa Rita Ranch', date: '2025-01-10' },
      { decision: 'Signed with UBuildIt Williamson Team (Randy Poston)', date: '2025-01-15' },
      { decision: 'French Country Estate style with ~7,526 sq ft plan', date: '2025-01-20' },
    ]),
  ])
  console.log('  Project status snapshot')

  // Permits
  const permits = [
    { type: 'Building Permit', status: 'not_started' },
    { type: 'Septic/Sewer Permit', status: 'not_started' },
    { type: 'Electrical Permit', status: 'not_started' },
    { type: 'Plumbing Permit', status: 'not_started' },
    { type: 'HVAC Permit', status: 'not_started' },
  ]
  for (const p of permits) {
    await client.query(`
      INSERT INTO permits (project_id, type, status)
      VALUES ($1, $2, $3)
    `, [projectId, p.type, p.status])
  }
  console.log(`  ${permits.length} permits`)

  // Step 9: Vendor data
  console.log('\n--- Step 9: Vendor data ---')
  const vendorData = [
    { name: 'Kent Moore Cabinets Ltd', category: 'Cabinets', notes: 'UBuildIt Recommended - Cabinet specialist only' },
    { name: 'ProSource', category: 'Multi-Service', notes: 'UBuildIt Recommended - Cabinets, Hardware, Flooring, Countertops, Bath Hardware' },
    { name: 'High-Tech Flooring & Design', category: 'Multi-Service', notes: 'UBuildIt Recommended - Cabinets, Flooring, Countertops' },
    { name: 'Parrish & Company Inc.', category: 'Multi-Service', notes: 'UBuildIt Recommended - Appliances, Grill, Fireplace, Cabinets, Hardware' },
    { name: 'Builder Benefits Lighting Inc.', category: 'Lighting', notes: 'UBuildIt Recommended - Multiple locations, builder pricing' },
    { name: 'FBS Appliance', category: 'Appliances', notes: 'UBuildIt Recommended - Statewide locations' },
    { name: 'K&N Appliance Gallery', category: 'Appliances', notes: 'UBuildIt Recommended - Austin location' },
    { name: '84 Lumber', category: 'Windows/Doors', notes: 'UBuildIt Recommended - Windows, Interior-Exterior Doors, Trim' },
    { name: "McCoy's Building Supply", category: 'Building Materials', notes: 'UBuildIt Recommended - Windows, Doors, Trim, Lumber' },
    { name: 'Texas Door and Trim', category: 'Doors/Trim', notes: 'UBuildIt Recommended - Molding/Trim, Int/Ext Doors, Stairs' },
    { name: 'Floor & Décor', category: 'Flooring', notes: 'UBuildIt Recommended - Over 1M sq ft in-stock, pro rewards' },
    { name: 'Craftsman Concrete Floors', category: 'Concrete Flooring', notes: 'UBuildIt Recommended - Concrete floor specialist' },
    { name: 'Austin Contractor Services (ACS)', category: 'Fireplace/Outdoor', notes: 'UBuildIt Recommended - Fireplace, Gutters, Garage Doors, Outdoor Kitchen' },
    { name: 'Webco Fireplace Distributing', category: 'Fireplace', notes: 'UBuildIt Recommended - Fireplace specialist' },
    { name: 'Acme Brick Company', category: 'Masonry', notes: 'UBuildIt Recommended - Brick supplier' },
    { name: 'South Texas Brick and Stone', category: 'Masonry', notes: 'UBuildIt Recommended - Brick and stone supplier' },
    { name: 'Sherwin-Williams', category: 'Paint', notes: 'UBuildIt Recommended - Paint supplier' },
    { name: 'Anchor Ventana', category: 'Specialty Glass', notes: 'UBuildIt Recommended - Builder pricing, shower doors, mirrors' },
    { name: 'Viking Fence', category: 'Fencing', notes: 'UBuildIt Recommended - Fence and deck specialist' },
    { name: 'Nailhead Spur Company', category: 'Metal Fencing', notes: 'UBuildIt Recommended - Metal fencing and stairs' },
    { name: 'IBP Installed Building Products', category: 'Insulation/Garage Doors', notes: 'UBuildIt Recommended - Garage doors and insulation' },
    { name: 'Mesa Home Systems', category: 'Home Automation', notes: 'UBuildIt Recommended - Home automation, low voltage, AV, security' },
    { name: 'Home Depot', category: 'Building Materials', notes: 'UBuildIt Recommended - Multiple services, ProDesk account available' },
  ]
  for (const v of vendorData) {
    await client.query(`
      INSERT INTO vendors (project_id, company_name, category, status, notes, auto_track_emails)
      VALUES ($1, $2, $3, 'potential', $4, true)
    `, [projectId, v.name, v.category, v.notes])
  }
  console.log(`  ${vendorData.length} vendors`)

  // Vendor contacts
  console.log('\n--- Step 10: Vendor contacts ---')
  const vendorContacts = [
    { company: 'Kent Moore Cabinets Ltd', name: 'Contact Person', phone: '512-836-0130', role: 'Sales', notes: '8403 Cross Park Dr. 1A, Austin, Texas 78754' },
    { company: 'ProSource', name: 'Brandi Norris', phone: '512-836-7888 ext. 1488', role: 'Sales Representative', notes: '2315 Rutland Ste 104, Austin, Texas 78758' },
    { company: 'High-Tech Flooring & Design', name: 'Louis El-Deir', phone: '512-834-0110', role: 'Contact', notes: '15408 Long Vista Dr., Austin, Texas 78758' },
    { company: 'Parrish & Company Inc.', name: 'Rhonda Lewis', phone: '512-835-0937', role: 'Sales', notes: '3600 E. Old Settlers, Round Rock, Texas 78665' },
    { company: 'Builder Benefits Lighting Inc.', name: 'Scott Baily', phone: '512-491-0481', role: 'Austin Assigned Rep', notes: '10401 N Burnet Rd., Austin, TX 78758' },
    { company: 'FBS Appliance', name: 'Adam Pina', phone: '512-834-1442', role: 'Sales', notes: '7816 Burnet Road, Austin, Texas 78758' },
    { company: 'K&N Appliance Gallery', name: 'Jared Parker', phone: '512-566-4648', role: 'Sales', notes: '7719 Burnet Rd. Ste A, Austin, TX 78757' },
    { company: '84 Lumber', name: 'Tim McPherron', phone: '512-844-1458', role: 'Sales', notes: '108 Madison Oaks Ave, Georgetown, TX 78626' },
    { company: '84 Lumber', name: 'Jesus Garcia', phone: '512-868-4484', role: 'Sales Coordinator', notes: '108 Madison Oaks Ave, Georgetown, TX 78626' },
    { company: "McCoy's Building Supply", name: 'Justin Bernethy', phone: '512-863-0865', role: 'Sales', notes: '100 Leander Rd., Georgetown, TX 78626' },
    { company: 'Texas Door and Trim', name: 'Daniel Evans', phone: '214-342-9393', role: 'Sales', notes: '2120 Denton Drive 109, Austin, TX 78758' },
    { company: 'Floor & Décor', name: 'Kevin McDonald', phone: '512-820-0785', role: 'Sales', notes: '12901 N I35, Austin, TX 78753' },
    { company: 'Craftsman Concrete Floors', name: 'Jeremy Cox', phone: '512-593-0030', role: 'Contact', notes: '312 Ashley Dawn Lane, Austin, TX 78704' },
    { company: 'Austin Contractor Services (ACS)', name: 'Todd Weaver', phone: '512-927-5045', role: 'Sales', notes: '4300 Nixon Lane, Austin, TX 78725' },
    { company: 'Webco Fireplace Distributing', name: 'Randy Pettis', phone: '512-836-8476', role: 'Sales', notes: '12012 N Lamar Blvd, Austin, TX 78753' },
    { company: 'Acme Brick Company', name: 'Shawn McElroy', phone: '512-244-7600', role: 'Sales', notes: '631 Round Rock West Dr, Round Rock, Texas 78681' },
    { company: 'South Texas Brick and Stone', name: 'Hunter May', phone: '737-205-5003', role: 'Sales', notes: '2900 Oak Springs Dr, Austin, TX 78702' },
    { company: 'Sherwin-Williams', name: 'Kyle Rhodes', phone: '512-639-1677', role: 'Sales', notes: '2423 Williams Dr Ste 121, Georgetown, TX 78628' },
    { company: 'Anchor Ventana', name: 'Carol George', phone: '512-388-9400', role: 'Sales', notes: '1609 Chisholm Trail #100, Round Rock, TX 78681' },
    { company: 'Viking Fence', name: 'Ryan Frank', phone: '512-294-3700', role: 'Sales', notes: '9602 Gray Blvd, Austin, TX 78758' },
    { company: 'Nailhead Spur Company', name: 'Robert', phone: '512-588-6112', role: 'Sales', notes: '1840 E. Polk St., Burnet, TX' },
    { company: 'IBP Installed Building Products', name: 'Contact Person', phone: '737-345-8076', role: 'Sales', notes: '2013 Centimeter Circle B, Austin, TX 78758' },
    { company: 'Mesa Home Systems', name: 'Lloyd Bjorgo', phone: '512-258-2599', role: 'Sales', notes: '7304 Mcneil Dr Ste 504, Austin, TX 78729' },
    { company: 'Home Depot', name: 'ProDesk', phone: '620-240-0901', role: 'ProDesk Account', notes: 'Account #4057159000 - Nationwide locations' },
  ]
  for (const c of vendorContacts) {
    await client.query(`
      INSERT INTO contacts (project_id, type, company, name, phone, role, notes)
      VALUES ($1, 'vendor', $2, $3, $4, $5, $6)
    `, [projectId, c.company, c.name, c.phone, c.role, c.notes])
  }
  console.log(`  ${vendorContacts.length} vendor contacts`)

  // Final verification
  console.log('\n--- Verification ---')
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  console.log(`Tables created: ${tables.rows.length}`)
  for (const t of tables.rows) {
    const count = await client.query(`SELECT COUNT(*) FROM ${t.table_name}`)
    console.log(`  ${t.table_name}: ${count.rows[0].count} rows`)
  }

  await client.end()
  console.log('\nDatabase setup complete!')
}

run().catch(err => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
