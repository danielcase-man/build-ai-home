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
    storage_url TEXT,
    is_document BOOLEAN DEFAULT FALSE,
    is_image BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
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
