-- BID MANAGEMENT SCHEMA ADDITIONS
-- Add this to your existing Supabase database

-- =============================================
-- BIDS TABLE - Stores bid options before selection
-- =============================================
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    -- Vendor Information
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name VARCHAR(255) NOT NULL,
    vendor_contact VARCHAR(255),
    vendor_email VARCHAR(255),
    vendor_phone VARCHAR(50),

    -- Bid Details
    category VARCHAR(100) NOT NULL, -- e.g., "Windows & Doors", "Foundation", "HVAC"
    subcategory VARCHAR(100),
    description TEXT NOT NULL,

    -- Pricing
    total_amount DECIMAL(12, 2) NOT NULL,
    line_items JSONB, -- Detailed breakdown: [{item: "...", quantity: 1, unit_price: 1000, total: 1000}, ...]

    -- Scope & Terms
    scope_of_work TEXT,
    inclusions JSONB, -- Array of what's included
    exclusions JSONB, -- Array of what's NOT included
    payment_terms TEXT,
    warranty_terms TEXT,

    -- Timeline
    estimated_duration VARCHAR(100), -- e.g., "2-3 weeks"
    lead_time_weeks INTEGER,
    valid_until DATE, -- Bid expiration date

    -- Status & Selection
    status VARCHAR(20) CHECK (status IN ('pending', 'under_review', 'selected', 'rejected', 'expired')) DEFAULT 'pending',
    selection_notes TEXT, -- Why selected/rejected
    selected_date DATE,

    -- Source Tracking
    source VARCHAR(50) DEFAULT 'email', -- email, manual, phone, etc.
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    source_document TEXT, -- URL or reference to PDF/doc

    -- AI Extraction Metadata
    ai_extracted BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3, 2), -- 0.00 to 1.00
    ai_extraction_notes TEXT,
    needs_review BOOLEAN DEFAULT TRUE,

    -- Comparison & Notes
    pros TEXT, -- Advantages of this bid
    cons TEXT, -- Disadvantages
    internal_notes TEXT,
    comparison_rank INTEGER, -- User's ranking among competing bids

    -- Timestamps
    bid_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX idx_bids_project ON bids(project_id);
CREATE INDEX idx_bids_vendor ON bids(vendor_id);
CREATE INDEX idx_bids_category ON bids(category);
CREATE INDEX idx_bids_status ON bids(status);
CREATE INDEX idx_bids_email ON bids(email_id);

-- Updated_at trigger
CREATE TRIGGER update_bids_updated_at
    BEFORE UPDATE ON bids
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- BID COMPARISONS TABLE - Track bid evaluations
-- =============================================
CREATE TABLE bid_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    description TEXT,

    -- Comparison metadata
    bid_ids UUID[] NOT NULL, -- Array of bid IDs being compared
    evaluation_criteria JSONB, -- Custom criteria and scores

    -- Selection
    selected_bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
    selection_date DATE,
    selection_rationale TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_bid_comparisons_project ON bid_comparisons(project_id);
CREATE INDEX idx_bid_comparisons_selected ON bid_comparisons(selected_bid_id);

-- =============================================
-- BID ATTACHMENTS - Store bid-related files
-- =============================================
CREATE TABLE bid_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    storage_url TEXT NOT NULL,
    attachment_type VARCHAR(50), -- 'proposal', 'quote', 'scope', 'terms', 'other'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_bid_attachments_bid ON bid_attachments(bid_id);

-- =============================================
-- HELPER VIEWS
-- =============================================

-- View for pending bids needing review
CREATE VIEW pending_bids_summary AS
SELECT
    b.id,
    b.project_id,
    b.category,
    b.vendor_name,
    b.total_amount,
    b.status,
    b.needs_review,
    b.ai_extracted,
    b.received_date,
    b.valid_until,
    p.name as project_name,
    COUNT(DISTINCT bc.id) as competing_bids_count
FROM bids b
LEFT JOIN projects p ON b.project_id = p.id
LEFT JOIN bids bc ON b.category = bc.category
    AND b.project_id = bc.project_id
    AND bc.id != b.id
    AND bc.status != 'rejected'
WHERE b.status IN ('pending', 'under_review')
GROUP BY b.id, p.name;

-- View for bid comparison by category
CREATE VIEW bids_by_category AS
SELECT
    category,
    project_id,
    COUNT(*) as bid_count,
    MIN(total_amount) as lowest_bid,
    MAX(total_amount) as highest_bid,
    AVG(total_amount) as average_bid,
    COUNT(CASE WHEN status = 'selected' THEN 1 END) as selected_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
FROM bids
GROUP BY category, project_id;

-- =============================================
-- SAMPLE DATA NOTES
-- =============================================

-- Example bid structure:
/*
{
  "vendor_name": "Prestige Steel",
  "category": "Windows & Doors",
  "total_amount": 68446.00,
  "line_items": [
    {
      "item": "Living Room - Steel Door 8' x 10'",
      "quantity": 1,
      "unit_price": 8500.00,
      "total": 8500.00,
      "specs": "Thermally broken, triple pane"
    },
    {
      "item": "Kitchen - Steel Windows (6 units)",
      "quantity": 6,
      "unit_price": 2800.00,
      "total": 16800.00
    }
  ],
  "inclusions": [
    "All hardware and installation",
    "3-year warranty on workmanship",
    "10-year warranty on materials"
  ],
  "exclusions": [
    "Structural modifications",
    "Electrical work for motorized blinds",
    "Paint/finish on surrounding walls"
  ]
}
*/

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to convert selected bid to budget_item
CREATE OR REPLACE FUNCTION finalize_bid_to_budget(bid_uuid UUID)
RETURNS UUID AS $$
DECLARE
    new_budget_item_id UUID;
    bid_record RECORD;
BEGIN
    -- Get bid details
    SELECT * INTO bid_record FROM bids WHERE id = bid_uuid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bid not found: %', bid_uuid;
    END IF;

    IF bid_record.status != 'selected' THEN
        RAISE EXCEPTION 'Bid must be selected before finalizing: %', bid_uuid;
    END IF;

    -- Insert into budget_items
    INSERT INTO budget_items (
        project_id,
        category,
        subcategory,
        description,
        estimated_cost,
        vendor_id,
        status,
        approval_date,
        notes
    ) VALUES (
        bid_record.project_id,
        bid_record.category,
        bid_record.subcategory,
        bid_record.description || ' - ' || bid_record.vendor_name,
        bid_record.total_amount,
        bid_record.vendor_id,
        'approved',
        CURRENT_DATE,
        'Finalized from bid #' || bid_record.id || '. ' || COALESCE(bid_record.selection_notes, '')
    )
    RETURNING id INTO new_budget_item_id;

    -- Update bid to mark as finalized
    UPDATE bids SET
        status = 'selected',
        selected_date = CURRENT_DATE,
        internal_notes = COALESCE(internal_notes, '') || ' [Finalized to budget_item: ' || new_budget_item_id || ']'
    WHERE id = bid_uuid;

    RETURN new_budget_item_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reject competing bids when one is selected
CREATE OR REPLACE FUNCTION reject_competing_bids(selected_bid_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    rejected_count INTEGER;
    bid_record RECORD;
BEGIN
    SELECT * INTO bid_record FROM bids WHERE id = selected_bid_uuid;

    -- Reject other bids in same category for same project
    UPDATE bids SET
        status = 'rejected',
        selection_notes = 'Alternative bid selected'
    WHERE project_id = bid_record.project_id
        AND category = bid_record.category
        AND id != selected_bid_uuid
        AND status IN ('pending', 'under_review');

    GET DIAGNOSTICS rejected_count = ROW_COUNT;

    RETURN rejected_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE bids IS 'Stores vendor bid options before final selection';
COMMENT ON COLUMN bids.line_items IS 'JSONB array of detailed pricing breakdown';
COMMENT ON COLUMN bids.ai_confidence IS 'Confidence score from AI extraction (0.00-1.00)';
COMMENT ON COLUMN bids.needs_review IS 'Flag for bids requiring human review';
COMMENT ON FUNCTION finalize_bid_to_budget IS 'Converts selected bid to approved budget_item';
COMMENT ON FUNCTION reject_competing_bids IS 'Auto-rejects other bids when one is selected';
