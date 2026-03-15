-- ===============================================================
-- Migration 003: Financial Tracking (Plaid + Contracts + Invoices)
-- ===============================================================

-- Plaid bank connections (one per bank link)
CREATE TABLE IF NOT EXISTS plaid_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    institution_name VARCHAR(255) NOT NULL,
    institution_id VARCHAR(100),
    item_id VARCHAR(255) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,                     -- Encrypted via token-encryption.ts
    consent_expiration TIMESTAMP WITH TIME ZONE,
    cursor VARCHAR(255),                            -- Plaid sync cursor for incremental fetch
    accounts JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) CHECK (status IN ('active', 'needs_reauth', 'disconnected', 'error')) DEFAULT 'active',
    error_code VARCHAR(100),
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_plaid_connections_project ON plaid_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_plaid_connections_item ON plaid_connections(item_id);

ALTER TABLE plaid_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage plaid connections" ON plaid_connections
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_plaid_connections_updated_at BEFORE UPDATE ON plaid_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vendor contracts (what's owed under agreement)
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
    budget_item_id UUID REFERENCES budget_items(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_terms TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'disputed')) DEFAULT 'draft',
    document_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage contracts" ON contracts
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Invoices received from vendors
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100),
    description TEXT,
    amount DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    date_issued DATE NOT NULL,
    date_due DATE,
    date_paid DATE,
    status VARCHAR(20) CHECK (status IN ('received', 'approved', 'partial', 'paid', 'overdue', 'disputed', 'voided')) DEFAULT 'received',
    payment_method VARCHAR(50),
    document_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date_due ON invoices(date_due);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage invoices" ON invoices
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bank transactions from Plaid
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    plaid_connection_id UUID REFERENCES plaid_connections(id) ON DELETE SET NULL,
    plaid_transaction_id VARCHAR(255) UNIQUE,
    account_id VARCHAR(255),
    account_name VARCHAR(255),
    date DATE NOT NULL,
    authorized_date DATE,
    amount DECIMAL(12, 2) NOT NULL,                 -- positive = money out (payment)
    merchant_name VARCHAR(255),
    name VARCHAR(500),
    payment_channel VARCHAR(50),
    transaction_type VARCHAR(50),
    plaid_category JSONB,
    iso_currency_code VARCHAR(3) DEFAULT 'USD',
    pending BOOLEAN DEFAULT FALSE,
    -- Matching fields
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    budget_item_id UUID REFERENCES budget_items(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    match_status VARCHAR(20) CHECK (match_status IN ('unmatched', 'auto_matched', 'confirmed', 'excluded', 'manual')) DEFAULT 'unmatched',
    match_confidence DECIMAL(3, 2),
    category_override VARCHAR(100),
    is_construction_related BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_id ON transactions(plaid_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_vendor ON transactions(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_budget_item ON transactions(budget_item_id) WHERE budget_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_match_status ON transactions(match_status);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_name);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage transactions" ON transactions
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Payments linking transactions to invoices (many-to-many for partial payments)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL,
    date DATE NOT NULL,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    source VARCHAR(50) CHECK (source IN ('plaid', 'manual', 'construction_loan_draw')) DEFAULT 'manual',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_vendor ON payments(vendor_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage payments" ON payments
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vendor matching rules for auto-categorizing transactions
CREATE TABLE IF NOT EXISTS vendor_match_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    match_pattern VARCHAR(255) NOT NULL,
    budget_category VARCHAR(100),
    match_type VARCHAR(20) CHECK (match_type IN ('exact', 'contains', 'regex')) DEFAULT 'contains',
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_vendor_match_rules_project ON vendor_match_rules(project_id);

ALTER TABLE vendor_match_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage vendor match rules" ON vendor_match_rules
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_vendor_match_rules_updated_at BEFORE UPDATE ON vendor_match_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add plaid_merchant_name to vendors for auto-matching
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS plaid_merchant_name VARCHAR(255);
