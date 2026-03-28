-- =============================================
-- TAKEOFF & BID PACKAGE SCHEMA
-- Supports: Plans → Takeoff → Bid Packages → Vendor Outreach
-- =============================================

-- Takeoff Runs: each execution of a takeoff against plan data
CREATE TABLE IF NOT EXISTS takeoff_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- What trade/scope this takeoff covers
    trade VARCHAR(100) NOT NULL,           -- 'framing', 'plumbing', 'electrical', 'windows_doors', etc.
    name VARCHAR(255) NOT NULL,            -- 'Lumber Takeoff v1', 'Window Schedule v2'
    description TEXT,

    -- Plan versions used as input
    plan_sources JSONB,                    -- [{name: "KFA Architectural 12/17/25", type: "architectural", confidence: "text_extractable"}, ...]

    -- Quality metrics
    confidence_pct INTEGER CHECK (confidence_pct BETWEEN 0 AND 100),
    gaps JSONB,                            -- ["Header sizes not verified against structural", "Garage interior walls estimated"]
    notes TEXT,

    -- Status
    status VARCHAR(20) CHECK (status IN ('draft', 'review', 'final', 'superseded')) DEFAULT 'draft',
    superseded_by UUID REFERENCES takeoff_runs(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Takeoff Items: individual line items from a takeoff
CREATE TABLE IF NOT EXISTS takeoff_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    takeoff_run_id UUID NOT NULL REFERENCES takeoff_runs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Categorization
    category VARCHAR(100) NOT NULL,        -- 'wall_framing', 'roof_framing', 'sheathing', 'hardware', 'floor_framing'
    subcategory VARCHAR(100),              -- 'exterior_walls', 'interior_walls', 'garage'
    trade VARCHAR(100) NOT NULL,           -- matches takeoff_run.trade

    -- Item details
    item_name VARCHAR(255) NOT NULL,       -- '2x8 T-Stud 10ft', 'ZIP System 4x8 Sheet', 'LVL 1-3/4x11-7/8'
    description TEXT,
    material_spec VARCHAR(255),            -- 'SPF #2', 'PT SYP .40 ACQ', 'Huber ZIP 7/16'
    species_grade VARCHAR(100),            -- 'SPF #2', 'SYP #1', 'Doug Fir Select'

    -- Quantities
    quantity DECIMAL(12, 2) NOT NULL,
    unit VARCHAR(30) NOT NULL,             -- 'EA', 'LF', 'SF', 'BF', 'sheets', 'LBS'
    waste_factor DECIMAL(4, 3),            -- 0.100 for 10%
    quantity_with_waste DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * (1 + COALESCE(waste_factor, 0))) STORED,

    -- Dimensions (for lumber)
    nominal_width VARCHAR(10),             -- '2x8', '2x6', '4x4'
    length_inches INTEGER,                 -- 120 for 10ft
    length_feet DECIMAL(6, 2),             -- 10.00

    -- Cost estimates (optional, filled later from pricing data)
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * (1 + COALESCE(waste_factor, 0)) * COALESCE(unit_cost, 0)) STORED,

    -- Source & confidence
    source VARCHAR(50) DEFAULT 'calculated', -- 'calculated', 'structural_plan', 'estimated', 'vendor_spec'
    confidence VARCHAR(20) DEFAULT 'calculated', -- 'verified', 'calculated', 'estimated', 'gap'
    source_detail TEXT,                    -- 'Sheet A2.1, Detail 3/A2.1' or 'Estimated from total wall length'

    -- Linking
    knowledge_id UUID,                     -- Link to construction_knowledge item if applicable
    budget_item_id UUID REFERENCES budget_items(id) ON DELETE SET NULL,

    sort_order INTEGER DEFAULT 0,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Bid Packages: groups of takeoff items bundled for vendor outreach
CREATE TABLE IF NOT EXISTS bid_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    takeoff_run_id UUID REFERENCES takeoff_runs(id) ON DELETE SET NULL,

    -- Package details
    trade VARCHAR(100) NOT NULL,           -- 'framing', 'lumber_supply', 'windows_doors'
    title VARCHAR(255) NOT NULL,           -- 'Framing Lumber & Materials Package'
    scope_of_work TEXT,                    -- Full SOW text
    special_requirements TEXT,             -- 'Delivery to 708 Purple Salvia Cove, Liberty Hill TX'

    -- Quantities summary
    item_count INTEGER,
    estimated_total DECIMAL(12, 2),        -- Sum of takeoff item costs if available

    -- Status tracking
    status VARCHAR(30) CHECK (status IN ('draft', 'ready', 'sent', 'responses_received', 'evaluating', 'awarded', 'cancelled')) DEFAULT 'draft',
    deadline DATE,                         -- Bid response deadline
    sent_date DATE,
    awarded_date DATE,
    awarded_bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,

    -- Vendor outreach tracking
    vendors_contacted JSONB,               -- [{vendor_id, vendor_name, contact_email, sent_date, status, bid_id}]

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Bid Package Items: links takeoff items to bid packages
CREATE TABLE IF NOT EXISTS bid_package_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bid_package_id UUID NOT NULL REFERENCES bid_packages(id) ON DELETE CASCADE,
    takeoff_item_id UUID REFERENCES takeoff_items(id) ON DELETE SET NULL,

    -- Denormalized for the bid document (vendors see this)
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    material_spec VARCHAR(255),
    quantity DECIMAL(12, 2) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    notes TEXT,

    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX idx_takeoff_runs_project ON takeoff_runs(project_id);
CREATE INDEX idx_takeoff_runs_trade ON takeoff_runs(trade);
CREATE INDEX idx_takeoff_runs_status ON takeoff_runs(status);
CREATE INDEX idx_takeoff_items_run ON takeoff_items(takeoff_run_id);
CREATE INDEX idx_takeoff_items_project ON takeoff_items(project_id);
CREATE INDEX idx_takeoff_items_category ON takeoff_items(category);
CREATE INDEX idx_takeoff_items_trade ON takeoff_items(trade);
CREATE INDEX idx_bid_packages_project ON bid_packages(project_id);
CREATE INDEX idx_bid_packages_trade ON bid_packages(trade);
CREATE INDEX idx_bid_packages_status ON bid_packages(status);
CREATE INDEX idx_bid_package_items_package ON bid_package_items(bid_package_id);

-- Updated_at triggers
CREATE TRIGGER update_takeoff_runs_updated_at
    BEFORE UPDATE ON takeoff_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_takeoff_items_updated_at
    BEFORE UPDATE ON takeoff_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bid_packages_updated_at
    BEFORE UPDATE ON bid_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS policies (match existing pattern — project-scoped access)
ALTER TABLE takeoff_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_package_items ENABLE ROW LEVEL SECURITY;
