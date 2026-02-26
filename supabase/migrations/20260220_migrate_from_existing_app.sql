-- Migration: Bring useful schema from existing-app branch
-- Tables: site_information, building_specifications, vendor_category_requirements, vendor_bid_requirements
-- Function: calculate_bid_completeness()
-- Storage: 6 organized buckets
-- Note: RLS simplified for authenticated users (no project_members/owner_id pattern from old app)

-- ============================================================
-- 1. site_information table
-- Stores property-specific data: soil, zoning, setbacks, utilities
-- ============================================================

CREATE TABLE IF NOT EXISTS public.site_information (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Survey and Location Data
  property_survey JSONB,
  topographic_data JSONB,
  utility_locations JSONB,
  access_routes JSONB,

  -- Soil and Environmental
  soil_conditions JSONB,
  soil_bearing_capacity NUMERIC(10,2),
  water_table_depth NUMERIC(10,2),
  environmental_factors JSONB,

  -- Zoning and Legal
  zoning_classification TEXT,
  setback_requirements JSONB,
  hoa_restrictions JSONB,
  building_codes JSONB,

  -- Infrastructure
  well_location POINT,
  septic_location POINT,
  flood_zone TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_information ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view site information"
  ON public.site_information FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage site information"
  ON public.site_information FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_site_information_project ON public.site_information(project_id);
CREATE INDEX idx_site_information_soil ON public.site_information USING GIN (soil_conditions);
CREATE INDEX idx_site_information_utility ON public.site_information USING GIN (utility_locations);

CREATE TRIGGER update_site_information_updated_at
  BEFORE UPDATE ON public.site_information
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2. building_specifications table
-- Stores detailed construction specs per project (JSONB-heavy)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.building_specifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Foundation Specifications
  foundation_type TEXT,
  foundation_dimensions JSONB,
  concrete_requirements JSONB,

  -- Structural Specifications
  framing_type TEXT,
  lumber_specifications JSONB,
  structural_loads JSONB,

  -- Envelope Specifications
  roof_specifications JSONB,
  wall_specifications JSONB,
  window_door_specifications JSONB,
  exterior_materials JSONB,

  -- Mechanical Systems
  hvac_specifications JSONB,
  plumbing_specifications JSONB,
  electrical_specifications JSONB,

  -- Interior Systems
  flooring_specifications JSONB,
  interior_finishes JSONB,
  cabinetry_specifications JSONB,
  appliance_specifications JSONB,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.building_specifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view building specifications"
  ON public.building_specifications FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage building specifications"
  ON public.building_specifications FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_building_specifications_project ON public.building_specifications(project_id);
CREATE INDEX idx_building_specifications_hvac ON public.building_specifications USING GIN (hvac_specifications);
CREATE INDEX idx_building_specifications_electrical ON public.building_specifications USING GIN (electrical_specifications);

CREATE TRIGGER update_building_specifications_updated_at
  BEFORE UPDATE ON public.building_specifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 3. vendor_category_requirements table
-- Template system: what info to collect per vendor category
-- Uses text category_id (matches bid category strings) instead of UUID FK
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_category_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id TEXT NOT NULL,

  -- Requirement Definition
  requirement_name TEXT NOT NULL,
  requirement_description TEXT,
  data_type TEXT NOT NULL CHECK (data_type IN ('text', 'number', 'boolean', 'date', 'file', 'selection')),
  is_required BOOLEAN DEFAULT false,

  -- Validation Rules
  measurement_unit TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  selection_options JSONB,
  validation_pattern TEXT,

  -- UI Configuration
  help_text TEXT,
  display_order INTEGER DEFAULT 0,
  field_group TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vendor_category_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view vendor category requirements"
  ON public.vendor_category_requirements FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage category requirements"
  ON public.vendor_category_requirements FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_vendor_category_requirements_category ON public.vendor_category_requirements(category_id, display_order);
CREATE INDEX idx_vendor_category_requirements_options ON public.vendor_category_requirements USING GIN (selection_options);


-- ============================================================
-- 4. vendor_bid_requirements table
-- Tracks vendor responses to category requirements with scoring
-- Uses text category instead of UUID FK (matches bid category strings)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_bid_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  vendor_name TEXT NOT NULL,

  -- Bid Responses
  requirement_responses JSONB NOT NULL DEFAULT '{}',

  -- Quality Scoring
  completeness_score NUMERIC(3,2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vendor_bid_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bid requirements"
  ON public.vendor_bid_requirements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage bid requirements"
  ON public.vendor_bid_requirements FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_vendor_bid_requirements_project ON public.vendor_bid_requirements(project_id, category);
CREATE INDEX idx_vendor_bid_requirements_responses ON public.vendor_bid_requirements USING GIN (requirement_responses);

CREATE TRIGGER update_vendor_bid_requirements_updated_at
  BEFORE UPDATE ON public.vendor_bid_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 5. calculate_bid_completeness() function
-- Scores a vendor bid based on filled required fields
-- Adapted to use text-based category matching
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_bid_completeness(bid_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_required INTEGER;
  responses_provided INTEGER;
  bid_record RECORD;
BEGIN
  -- Get the bid record
  SELECT vbr.requirement_responses, vbr.category
  INTO bid_record
  FROM public.vendor_bid_requirements vbr
  WHERE vbr.id = bid_uuid;

  IF NOT FOUND THEN
    RETURN 0.0;
  END IF;

  -- Count total required fields for this category
  SELECT COUNT(*) INTO total_required
  FROM public.vendor_category_requirements vcr
  WHERE vcr.category_id = bid_record.category AND vcr.is_required = true;

  -- Count provided responses for required fields
  SELECT COUNT(*) INTO responses_provided
  FROM public.vendor_category_requirements vcr
  WHERE vcr.category_id = bid_record.category
    AND vcr.is_required = true
    AND bid_record.requirement_responses ? vcr.requirement_name
    AND bid_record.requirement_responses ->> vcr.requirement_name IS NOT NULL
    AND bid_record.requirement_responses ->> vcr.requirement_name != '';

  IF total_required = 0 THEN
    RETURN 1.0;
  END IF;

  RETURN ROUND(responses_provided::NUMERIC / total_required::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 6. Storage buckets
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('project-plans', 'project-plans', false, 104857600, ARRAY['application/pdf', 'application/dwg', 'image/jpeg', 'image/png']),
  ('project-photos', 'project-photos', false, 26214400, ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('project-permits', 'project-permits', false, 10485760, ARRAY['application/pdf']),
  ('project-reports', 'project-reports', false, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('project-specifications', 'project-specifications', false, 10485760, ARRAY['application/pdf']),
  ('vendor-documents', 'vendor-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for authenticated users
CREATE POLICY "Authenticated users can access project storage"
  ON storage.objects FOR ALL
  USING (
    bucket_id IN ('project-plans', 'project-photos', 'project-permits', 'project-reports', 'project-specifications', 'vendor-documents')
    AND auth.uid() IS NOT NULL
  );
