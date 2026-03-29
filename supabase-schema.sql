-- Supabase Database Schema for UBuildIt Process Manager

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects table (main project information)
CREATE TABLE projects (
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

-- Planning phase steps
CREATE TABLE planning_phase_steps (
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

-- Milestones
CREATE TABLE milestones (
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

-- Budget items
CREATE TABLE budget_items (
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

-- Contacts (team members, vendors, contractors)
CREATE TABLE contacts (
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

-- Documents
CREATE TABLE documents (
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

-- Tasks
CREATE TABLE tasks (
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

-- Permits
CREATE TABLE permits (
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

-- Email accounts
CREATE TABLE email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    provider VARCHAR(50) DEFAULT 'gmail',
    oauth_tokens JSONB, -- Encrypted in application
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMP WITH TIME ZONE,
    sync_frequency INTEGER DEFAULT 30, -- minutes
    gmail_history_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Emails
CREATE TABLE emails (
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

-- Email attachments
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
    filename VARCHAR(255),
    file_type VARCHAR(50),
    file_size INTEGER,
    gmail_attachment_id VARCHAR(255),
    storage_url TEXT,
    is_document BOOLEAN DEFAULT FALSE,
    is_image BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(email_id, filename)
);

-- Bid line items (normalized from bids.line_items JSONB)
CREATE TABLE bid_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    specs TEXT,
    room VARCHAR(100),
    location_detail VARCHAR(255),
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit VARCHAR(50),
    unit_price DECIMAL(12, 2),
    total_price DECIMAL(12, 2) NOT NULL,
    brand VARCHAR(100),
    model_number VARCHAR(100),
    finish VARCHAR(100),
    color VARCHAR(100),
    material VARCHAR(100),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    selection_id UUID REFERENCES selections(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Bid documents (source files for AI extraction)
CREATE TABLE bid_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    storage_path TEXT NOT NULL,
    source VARCHAR(50) DEFAULT 'upload',
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    dropbox_path TEXT,
    extraction_status VARCHAR(30) DEFAULT 'pending',
    extracted_text TEXT,
    ai_confidence DECIMAL(3, 2),
    ai_extraction_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Communications log
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    type VARCHAR(50) CHECK (type IN ('email', 'phone', 'meeting', 'text', 'other', 'daily_log', 'jobtread_comment')),
    subject TEXT,
    summary TEXT,
    action_items JSONB,
    decisions JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Daily project status
CREATE TABLE project_status (
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
    next_steps JSONB DEFAULT '[]'::jsonb,
    open_questions JSONB DEFAULT '[]'::jsonb,
    key_data_points JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(project_id, date)
);

-- Vendors
CREATE TABLE vendors (
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

-- Notification queue
CREATE TABLE notification_queue (
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

-- Create indexes for better performance
CREATE INDEX idx_projects_phase ON projects(phase);
CREATE INDEX idx_milestones_project_id ON milestones(project_id);
CREATE INDEX idx_milestones_status ON milestones(status);
CREATE INDEX idx_budget_items_project_id ON budget_items(project_id);
CREATE INDEX idx_budget_items_category ON budget_items(category);
CREATE INDEX idx_contacts_project_id ON contacts(project_id);
CREATE INDEX idx_contacts_type ON contacts(type);
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_permits_project_id ON permits(project_id);
CREATE INDEX idx_emails_project_id ON emails(project_id);
CREATE INDEX idx_emails_sender_email ON emails(sender_email);
CREATE INDEX idx_emails_received_date ON emails(received_date);
CREATE INDEX idx_project_status_project_date ON project_status(project_id, date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_planning_phase_steps_updated_at BEFORE UPDATE ON planning_phase_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_items_updated_at BEFORE UPDATE ON budget_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_permits_updated_at BEFORE UPDATE ON permits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_communications_updated_at BEFORE UPDATE ON communications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_phase_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (you'll need to customize based on your auth setup)
-- For now, these allow authenticated users to access their own data
CREATE POLICY "Users can view their own projects" ON projects
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view project data" ON planning_phase_steps
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view milestones" ON milestones
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view budget items" ON budget_items
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view contacts" ON contacts
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view documents" ON documents
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view tasks" ON tasks
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view permits" ON permits
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view email accounts" ON email_accounts
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view emails" ON emails
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view email attachments" ON email_attachments
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view communications" ON communications
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view project status" ON project_status
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view vendors" ON vendors
    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view notifications" ON notification_queue
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Migration: Add bid_id FK to selections for cross-referencing
ALTER TABLE selections ADD COLUMN IF NOT EXISTS bid_id UUID REFERENCES bids(id) ON DELETE SET NULL;

-- Migration: Selection ↔ Workflow Integration
ALTER TABLE selections ADD COLUMN IF NOT EXISTS knowledge_id UUID REFERENCES construction_knowledge(id) ON DELETE SET NULL;
ALTER TABLE selections ADD COLUMN IF NOT EXISTS needed_by_phase INTEGER;
ALTER TABLE selections ADD COLUMN IF NOT EXISTS needed_by_date DATE;
ALTER TABLE selections ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;
CREATE INDEX IF NOT EXISTS idx_selections_knowledge_id ON selections(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_selections_needed_by_date ON selections(needed_by_date);

-- Migration: Add audit_log table for change tracking
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    actor VARCHAR(100) DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ═══════════════════════════════════════════════════════════════════
-- Migration: JobTread Integration
-- ═══════════════════════════════════════════════════════════════════

-- Add jobtread_id columns to existing tables for deduplication during sync
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS jobtread_id VARCHAR(50) UNIQUE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS jobtread_id VARCHAR(50) UNIQUE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS jobtread_id VARCHAR(50) UNIQUE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS jobtread_id VARCHAR(50) UNIQUE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS jobtread_id VARCHAR(50) UNIQUE;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS jobtread_id VARCHAR(50) UNIQUE;

-- Track data source on budget items (manual, jobtread, email_extract)
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';

-- Partial indexes for fast dedup lookups during sync
CREATE INDEX IF NOT EXISTS idx_budget_items_jobtread_id ON budget_items(jobtread_id) WHERE jobtread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_jobtread_id ON tasks(jobtread_id) WHERE jobtread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_jobtread_id ON documents(jobtread_id) WHERE jobtread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_jobtread_id ON vendors(jobtread_id) WHERE jobtread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_jobtread_id ON contacts(jobtread_id) WHERE jobtread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communications_jobtread_id ON communications(jobtread_id) WHERE jobtread_id IS NOT NULL;

-- Sync state tracking per entity type
CREATE TABLE IF NOT EXISTS jobtread_sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    last_sync TIMESTAMP WITH TIME ZONE,
    last_sync_count INTEGER DEFAULT 0,
    sync_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(project_id, entity_type)
);

ALTER TABLE jobtread_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage jobtread sync state" ON jobtread_sync_state
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_jobtread_sync_state_updated_at BEFORE UPDATE ON jobtread_sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- Migration: Construction Loan Tracking
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS construction_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    lender_name VARCHAR(255) NOT NULL,
    loan_type VARCHAR(50) CHECK (loan_type IN ('construction', 'construction_permanent', '1x_close', '2x_close', 'bridge', 'other')),
    loan_amount DECIMAL(12, 2),
    cost_of_construction DECIMAL(12, 2),
    lot_value DECIMAL(12, 2),
    interest_rate DECIMAL(5, 3),
    loan_term_months INTEGER,
    ltv_ratio DECIMAL(5, 2),
    application_status VARCHAR(50) CHECK (application_status IN ('not_started', 'in_progress', 'submitted', 'under_review', 'conditionally_approved', 'approved', 'funded', 'rejected', 'withdrawn')) DEFAULT 'not_started',
    application_url TEXT,
    application_date DATE,
    approval_date DATE,
    funding_date DATE,
    closing_date DATE,
    loan_officer_name VARCHAR(255),
    loan_officer_email VARCHAR(255),
    loan_officer_phone VARCHAR(50),
    loan_contact_name VARCHAR(255),
    loan_contact_email VARCHAR(255),
    loan_contact_phone VARCHAR(50),
    loan_contact_nmls VARCHAR(50),
    notes TEXT,
    loan_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_construction_loans_project_id ON construction_loans(project_id);
CREATE INDEX IF NOT EXISTS idx_construction_loans_status ON construction_loans(application_status);

ALTER TABLE construction_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage construction loans" ON construction_loans
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_construction_loans_updated_at BEFORE UPDATE ON construction_loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Expand contacts type to include 'lender'
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_type_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_type_check
    CHECK (type IN ('consultant', 'vendor', 'contractor', 'architect', 'engineer', 'supplier', 'lender', 'other'));

-- ═══════════════════════════════════════════════════════════════════
-- Migration: Construction Knowledge Graph
-- ═══════════════════════════════════════════════════════════════════

-- Knowledge graph nodes — every step, material, inspection, and decision in building a home
CREATE TABLE IF NOT EXISTS construction_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phase_number INTEGER NOT NULL,
    trade VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(30) CHECK (item_type IN ('task', 'material', 'inspection', 'decision_point')) NOT NULL,
    parent_id UUID REFERENCES construction_knowledge(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    dependencies JSONB DEFAULT '[]'::jsonb,
    triggers JSONB DEFAULT '[]'::jsonb,
    materials JSONB DEFAULT '[]'::jsonb,
    inspection_required BOOLEAN DEFAULT FALSE,
    code_references JSONB DEFAULT '[]'::jsonb,
    typical_duration_days INTEGER,
    typical_cost_range JSONB,
    decision_required BOOLEAN DEFAULT FALSE,
    decision_options JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_construction_knowledge_phase ON construction_knowledge(phase_number);
CREATE INDEX IF NOT EXISTS idx_construction_knowledge_trade ON construction_knowledge(trade);
CREATE INDEX IF NOT EXISTS idx_construction_knowledge_type ON construction_knowledge(item_type);
CREATE INDEX IF NOT EXISTS idx_construction_knowledge_parent ON construction_knowledge(parent_id);

ALTER TABLE construction_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view construction knowledge" ON construction_knowledge
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_construction_knowledge_updated_at BEFORE UPDATE ON construction_knowledge
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Per-project state tracking for knowledge items
CREATE TABLE IF NOT EXISTS project_knowledge_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    knowledge_id UUID REFERENCES construction_knowledge(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('not_applicable', 'pending', 'ready', 'in_progress', 'completed', 'blocked')) DEFAULT 'pending',
    blocking_reason TEXT,
    actual_cost DECIMAL(12, 2),
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(project_id, knowledge_id)
);

CREATE INDEX IF NOT EXISTS idx_project_knowledge_state_project ON project_knowledge_state(project_id);
CREATE INDEX IF NOT EXISTS idx_project_knowledge_state_status ON project_knowledge_state(status);
CREATE INDEX IF NOT EXISTS idx_project_knowledge_state_knowledge ON project_knowledge_state(knowledge_id);

ALTER TABLE project_knowledge_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage project knowledge state" ON project_knowledge_state
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_project_knowledge_state_updated_at BEFORE UPDATE ON project_knowledge_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Per-project workflow phase tracking
CREATE TABLE IF NOT EXISTS workflow_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    phase_number INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('not_started', 'active', 'completed', 'on_hold')) DEFAULT 'not_started',
    started_date DATE,
    completed_date DATE,
    estimated_completion DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(project_id, phase_number)
);

ALTER TABLE workflow_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage workflow phases" ON workflow_phases
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_workflow_phases_updated_at BEFORE UPDATE ON workflow_phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- Migration: AI Research Cache
-- ═══════════════════════════════════════════════════════════════════

-- Cached AI research results with 7-day TTL
CREATE TABLE IF NOT EXISTS research_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    knowledge_id UUID REFERENCES construction_knowledge(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    search_type VARCHAR(30) CHECK (search_type IN ('vendor', 'material', 'pricing', 'code', 'general')) NOT NULL,
    results JSONB DEFAULT '{}'::jsonb,
    sources JSONB DEFAULT '[]'::jsonb,
    ai_analysis TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_research_cache_project ON research_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_research_cache_knowledge ON research_cache(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_research_cache_expires ON research_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_research_cache_lookup ON research_cache(project_id, query, search_type);

ALTER TABLE research_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage research cache" ON research_cache
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_research_cache_updated_at BEFORE UPDATE ON research_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- Migration: Document Extractions & Plan Rooms
-- ═══════════════════════════════════════════════════════════════════

-- AI extraction results from uploaded documents
CREATE TABLE IF NOT EXISTS document_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    extraction_type VARCHAR(50) CHECK (extraction_type IN (
        'room_schedule', 'fixture_count', 'window_schedule', 'door_schedule',
        'material_takeoff', 'electrical_schedule', 'plumbing_schedule', 'general'
    )) NOT NULL,
    extracted_data JSONB DEFAULT '{}'::jsonb,
    confidence DECIMAL(3, 2),
    ai_notes TEXT,
    reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_document_extractions_document ON document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_project ON document_extractions(project_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_type ON document_extractions(extraction_type);

ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage document extractions" ON document_extractions
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_document_extractions_updated_at BEFORE UPDATE ON document_extractions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Rooms extracted from architectural plans
CREATE TABLE IF NOT EXISTS plan_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    floor VARCHAR(50),
    square_footage DECIMAL(8, 2),
    ceiling_height DECIMAL(4, 1),
    fixtures JSONB DEFAULT '[]'::jsonb,
    finishes JSONB DEFAULT '[]'::jsonb,
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_plan_rooms_project ON plan_rooms(project_id);

ALTER TABLE plan_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage plan rooms" ON plan_rooms
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_plan_rooms_updated_at BEFORE UPDATE ON plan_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add file_url to documents if not populated (ensure column exists)
-- documents.file_url already exists in schema but may not be populated

-- ═══════════════════════════════════════════════════════════════════
-- Migration: Vendor Threads & Email Templates
-- ═══════════════════════════════════════════════════════════════════

-- Vendor conversation tracking
CREATE TABLE IF NOT EXISTS vendor_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_email VARCHAR(255),
    category VARCHAR(100),
    status VARCHAR(30) CHECK (status IN ('active', 'waiting_response', 'follow_up_needed', 'closed')) DEFAULT 'active',
    last_activity TIMESTAMP WITH TIME ZONE,
    follow_up_date DATE,
    bid_requested_date DATE,
    bid_received_date DATE,
    contract_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_vendor_threads_project ON vendor_threads(project_id);
CREATE INDEX IF NOT EXISTS idx_vendor_threads_status ON vendor_threads(status);
CREATE INDEX IF NOT EXISTS idx_vendor_threads_vendor ON vendor_threads(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_threads_email ON vendor_threads(vendor_email);

ALTER TABLE vendor_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage vendor threads" ON vendor_threads
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_vendor_threads_updated_at BEFORE UPDATE ON vendor_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Reusable email templates
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_project ON email_templates(project_id);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage email templates" ON email_templates
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- Migration: Change Orders, Draw Schedule, Warranties, Compliance
-- ═══════════════════════════════════════════════════════════════════

-- Change orders — scope/cost/schedule changes
CREATE TABLE IF NOT EXISTS change_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    change_order_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    requested_by VARCHAR(255),
    reason VARCHAR(30) CHECK (reason IN ('owner_request', 'field_condition', 'code_requirement', 'design_change', 'value_engineering')) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'completed')) DEFAULT 'draft',
    cost_impact DECIMAL(12, 2) DEFAULT 0,
    schedule_impact_days INTEGER,
    affected_milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    affected_budget_items JSONB DEFAULT '[]'::jsonb,
    contract_id UUID,
    approved_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_change_orders_project ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage change orders" ON change_orders
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_change_orders_updated_at BEFORE UPDATE ON change_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Draw schedule — construction loan disbursements
CREATE TABLE IF NOT EXISTS draw_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    loan_id UUID,
    draw_number INTEGER NOT NULL,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    milestone_name VARCHAR(255),
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'requested', 'inspected', 'approved', 'funded')) DEFAULT 'pending',
    request_date DATE,
    inspection_date DATE,
    approval_date DATE,
    funded_date DATE,
    retention_amount DECIMAL(12, 2),
    inspector_name VARCHAR(255),
    inspector_notes TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_draw_schedule_project ON draw_schedule(project_id);
CREATE INDEX IF NOT EXISTS idx_draw_schedule_status ON draw_schedule(status);

ALTER TABLE draw_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage draw schedule" ON draw_schedule
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_draw_schedule_updated_at BEFORE UPDATE ON draw_schedule
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Warranties — product/workmanship warranty tracking
CREATE TABLE IF NOT EXISTS warranties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name VARCHAR(255),
    category VARCHAR(100) NOT NULL,
    item_description TEXT NOT NULL,
    warranty_type VARCHAR(30) CHECK (warranty_type IN ('workmanship', 'materials', 'manufacturer', 'structural')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_months INTEGER,
    coverage_details TEXT,
    status VARCHAR(20) CHECK (status IN ('active', 'expiring_soon', 'expired', 'claimed')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_warranties_project ON warranties(project_id);
CREATE INDEX IF NOT EXISTS idx_warranties_end_date ON warranties(end_date);

ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage warranties" ON warranties
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_warranties_updated_at BEFORE UPDATE ON warranties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Subcontractor compliance — insurance/license tracking
CREATE TABLE IF NOT EXISTS subcontractor_compliance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name VARCHAR(255),
    insurance_type VARCHAR(30) CHECK (insurance_type IN ('GL', 'WC', 'auto', 'umbrella', 'professional')) NOT NULL,
    policy_number VARCHAR(100),
    carrier VARCHAR(255),
    coverage_amount DECIMAL(12, 2),
    effective_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_subcontractor_compliance_project ON subcontractor_compliance(project_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_compliance_expiration ON subcontractor_compliance(expiration_date);

ALTER TABLE subcontractor_compliance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage subcontractor compliance" ON subcontractor_compliance
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_subcontractor_compliance_updated_at BEFORE UPDATE ON subcontractor_compliance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- Migration: Site Photos & Voice Notes (Phase 7)
-- ═══════════════════════════════════════════════════════════════════

-- Photo documentation
CREATE TABLE IF NOT EXISTS site_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    knowledge_id UUID REFERENCES construction_knowledge(id) ON DELETE SET NULL,
    phase_number INTEGER,
    room VARCHAR(100),
    photo_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    photo_type VARCHAR(30) CHECK (photo_type IN ('progress', 'issue', 'inspection', 'documentation', 'before_after')) DEFAULT 'progress',
    taken_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    gps_latitude DECIMAL(10, 7),
    gps_longitude DECIMAL(10, 7),
    ai_description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_site_photos_project ON site_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_site_photos_phase ON site_photos(phase_number);
CREATE INDEX IF NOT EXISTS idx_site_photos_type ON site_photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_site_photos_taken ON site_photos(taken_at);

ALTER TABLE site_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage site photos" ON site_photos
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_site_photos_updated_at BEFORE UPDATE ON site_photos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Voice notes
CREATE TABLE IF NOT EXISTS voice_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    duration_seconds INTEGER,
    transcription TEXT,
    ai_summary TEXT,
    related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    related_knowledge_id UUID REFERENCES construction_knowledge(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_voice_notes_project ON voice_notes(project_id);

ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage voice notes" ON voice_notes
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_voice_notes_updated_at BEFORE UPDATE ON voice_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════
-- Migration: Punch Lists & Inspections (Phase 8)
-- ═══════════════════════════════════════════════════════════════════

-- Punch list items
CREATE TABLE IF NOT EXISTS punch_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    room VARCHAR(100),
    location_detail TEXT,
    category VARCHAR(100),
    description TEXT NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('cosmetic', 'functional', 'safety', 'structural')) DEFAULT 'functional',
    status VARCHAR(20) CHECK (status IN ('identified', 'assigned', 'in_progress', 'completed', 'verified')) DEFAULT 'identified',
    assigned_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    assigned_vendor_name VARCHAR(255),
    before_photo_id UUID REFERENCES site_photos(id) ON DELETE SET NULL,
    after_photo_id UUID REFERENCES site_photos(id) ON DELETE SET NULL,
    source VARCHAR(30) CHECK (source IN ('walkthrough', 'inspection', 'owner', 'consultant')) DEFAULT 'owner',
    due_date DATE,
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_punch_list_project ON punch_list_items(project_id);
CREATE INDEX IF NOT EXISTS idx_punch_list_status ON punch_list_items(status);
CREATE INDEX IF NOT EXISTS idx_punch_list_severity ON punch_list_items(severity);
CREATE INDEX IF NOT EXISTS idx_punch_list_room ON punch_list_items(room);

ALTER TABLE punch_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage punch list" ON punch_list_items
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_punch_list_items_updated_at BEFORE UPDATE ON punch_list_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inspections
CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    inspection_type VARCHAR(100) NOT NULL,
    knowledge_id UUID REFERENCES construction_knowledge(id) ON DELETE SET NULL,
    permit_id UUID REFERENCES permits(id) ON DELETE SET NULL,
    status VARCHAR(20) CHECK (status IN ('not_scheduled', 'scheduled', 'passed', 'failed', 'conditional')) DEFAULT 'not_scheduled',
    scheduled_date DATE,
    completed_date DATE,
    inspector_name VARCHAR(255),
    deficiencies JSONB DEFAULT '[]'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_inspections_project ON inspections(project_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(scheduled_date);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage inspections" ON inspections
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON inspections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Intelligence Engine Tables
-- ============================================================

-- Source Watermarks — track last-processed state for each data source
CREATE TABLE IF NOT EXISTS source_watermarks (
    source VARCHAR(50) PRIMARY KEY,
    last_processed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    last_processed_id VARCHAR(255),
    items_processed INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    metadata JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE source_watermarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON source_watermarks
    FOR ALL USING (true);

-- File Inventory — track every file in the Dropbox project directory
CREATE TABLE IF NOT EXISTS file_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL UNIQUE,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    modified_at TIMESTAMP WITH TIME ZONE,
    folder_category VARCHAR(100),
    processing_status VARCHAR(20) CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    agent_domain VARCHAR(50),
    result_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_file_inventory_project ON file_inventory(project_id);
CREATE INDEX IF NOT EXISTS idx_file_inventory_status ON file_inventory(processing_status);
CREATE INDEX IF NOT EXISTS idx_file_inventory_path ON file_inventory(file_path);
CREATE INDEX IF NOT EXISTS idx_file_inventory_domain ON file_inventory(agent_domain);

ALTER TABLE file_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON file_inventory
    FOR ALL USING (true);

CREATE TRIGGER update_file_inventory_updated_at BEFORE UPDATE ON file_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Intelligence Runs — log each run of the intelligence engine
CREATE TABLE IF NOT EXISTS intelligence_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) CHECK (status IN ('running', 'completed', 'failed', 'partial')) DEFAULT 'running',
    sources_checked JSONB DEFAULT '[]'::jsonb,
    changes_detected INTEGER DEFAULT 0,
    agents_invoked JSONB DEFAULT '[]'::jsonb,
    results JSONB DEFAULT '[]'::jsonb,
    errors JSONB DEFAULT '[]'::jsonb,
    duration_ms INTEGER,
    trigger_type VARCHAR(20) CHECK (trigger_type IN ('cron', 'manual', 'webhook')) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE intelligence_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON intelligence_runs
    FOR ALL USING (true);
