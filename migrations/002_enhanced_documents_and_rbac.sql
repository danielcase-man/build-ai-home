-- Migration 002: Enhanced Document Management + RBAC Foundation
-- Phase 2A: Document versioning, classification, entity linking
-- Phase 3A: User roles, audit trail
-- Date: 2026-03-20

-- ============================================================
-- PHASE 2A: Enhanced Document Model
-- ============================================================

-- Add new columns to documents table for versioning and linking
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_group_id UUID,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_path TEXT,
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_selection_id UUID REFERENCES selections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_classification VARCHAR(50);

-- Index for fast version-chain lookups
CREATE INDEX IF NOT EXISTS idx_documents_group_id ON documents(document_group_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_current ON documents(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_documents_classification ON documents(ai_classification);
CREATE INDEX IF NOT EXISTS idx_documents_vendor_id ON documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_documents_contact_id ON documents(contact_id);

-- For existing documents without a group_id, assign each its own id as group_id
-- (they are each the sole version in their group)
UPDATE documents SET document_group_id = id WHERE document_group_id IS NULL;

-- ============================================================
-- PHASE 3A: User Roles & RBAC
-- ============================================================

-- Enable Supabase Auth (RLS already enabled per CLAUDE.md)
-- User profiles table linking auth.users to project roles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE, -- links to auth.users(id) when available
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'consultant', 'vendor', 'viewer')) DEFAULT 'viewer',
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    invited_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    invited_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Project membership (which users can access which projects)
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'consultant', 'vendor', 'viewer')) DEFAULT 'viewer',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(project_id, user_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_profile_id);

-- ============================================================
-- PHASE 3C: Audit Trail
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'upload', 'status_change'
    entity_type VARCHAR(50) NOT NULL, -- 'document', 'bid', 'selection', 'task', 'budget_item', etc.
    entity_id UUID,
    entity_name TEXT, -- human-readable label for the entity
    changes JSONB, -- { field: { old: value, new: value } }
    metadata JSONB, -- extra context (IP, user agent, source)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_audit_log_project ON audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================
-- VENDOR INVITATION TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(20) DEFAULT 'vendor',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_vendor_invitations_token ON vendor_invitations(token);
CREATE INDEX IF NOT EXISTS idx_vendor_invitations_email ON vendor_invitations(email);
