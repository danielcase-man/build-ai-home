-- Migration 4: Performance Indexes, Utility Functions, and Sample Data

-- Enhanced indexes for performance
CREATE INDEX idx_project_requirements_project_phase ON public.project_requirements(project_id, phase_id);
CREATE INDEX idx_project_requirements_category ON public.project_requirements(category_id);
CREATE INDEX idx_project_documents_project_current ON public.project_documents(project_id, is_current_version) WHERE is_current_version = true;
CREATE INDEX idx_project_measurements_category ON public.project_measurements(project_id, measurement_category);
CREATE INDEX idx_vendor_bid_requirements_project ON public.vendor_bid_requirements(project_id, category_id);
CREATE INDEX idx_site_information_project ON public.site_information(project_id);
CREATE INDEX idx_building_specifications_project ON public.building_specifications(project_id);
CREATE INDEX idx_vendor_category_requirements_category ON public.vendor_category_requirements(category_id, display_order);

-- GIN indexes for JSONB columns to enable efficient JSON querying
CREATE INDEX idx_project_requirements_value_jsonb ON public.project_requirements USING GIN (value_jsonb);
CREATE INDEX idx_vendor_bid_requirements_responses ON public.vendor_bid_requirements USING GIN (requirement_responses);
CREATE INDEX idx_site_information_soil_conditions ON public.site_information USING GIN (soil_conditions);
CREATE INDEX idx_building_specifications_hvac ON public.building_specifications USING GIN (hvac_specifications);
CREATE INDEX idx_vendor_category_requirements_options ON public.vendor_category_requirements USING GIN (selection_options);

-- Function to calculate project completeness score
CREATE OR REPLACE FUNCTION calculate_project_completeness(project_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_requirements INTEGER;
  completed_requirements INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_requirements
  FROM public.project_requirements
  WHERE project_id = project_uuid AND is_required = true;
  
  SELECT COUNT(*) INTO completed_requirements
  FROM public.project_requirements
  WHERE project_id = project_uuid 
    AND is_required = true
    AND (value_text IS NOT NULL OR value_number IS NOT NULL OR value_boolean IS NOT NULL OR value_date IS NOT NULL OR value_jsonb IS NOT NULL OR value_file_id IS NOT NULL);
  
  IF total_requirements = 0 THEN
    RETURN 1.0;
  END IF;
  
  RETURN ROUND(completed_requirements::NUMERIC / total_requirements::NUMERIC, 3);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get vendor requirements for a specific category
CREATE OR REPLACE FUNCTION get_vendor_category_requirements(category_uuid UUID)
RETURNS TABLE (
  requirement_name TEXT,
  requirement_description TEXT,
  data_type TEXT,
  is_required BOOLEAN,
  measurement_unit TEXT,
  selection_options JSONB,
  help_text TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vcr.requirement_name,
    vcr.requirement_description,
    vcr.data_type,
    vcr.is_required,
    vcr.measurement_unit,
    vcr.selection_options,
    vcr.help_text
  FROM public.vendor_category_requirements vcr
  WHERE vcr.category_id = category_uuid
  ORDER BY vcr.display_order, vcr.requirement_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate vendor bid completeness
CREATE OR REPLACE FUNCTION calculate_bid_completeness(bid_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_required INTEGER;
  responses_provided INTEGER;
  bid_record RECORD;
BEGIN
  -- Get the bid record with category info
  SELECT vbr.requirement_responses, vbr.category_id 
  INTO bid_record
  FROM public.vendor_bid_requirements vbr
  WHERE vbr.id = bid_uuid;
  
  IF NOT FOUND THEN
    RETURN 0.0;
  END IF;
  
  -- Count total required fields for this category
  SELECT COUNT(*) INTO total_required
  FROM public.vendor_category_requirements vcr
  WHERE vcr.category_id = bid_record.category_id AND vcr.is_required = true;
  
  -- Count provided responses for required fields
  SELECT COUNT(*) INTO responses_provided
  FROM public.vendor_category_requirements vcr
  WHERE vcr.category_id = bid_record.category_id 
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

-- Populate vendor category requirements for common construction categories
-- First, let's get or create some basic vendor categories if they don't exist
INSERT INTO public.vendor_categories (name, category, phase, description) VALUES
('Excavation Contractors', 'Site Work', 'Pre-Construction Planning & Design', 'Site preparation and excavation services'),
('Concrete Contractors', 'Foundation', 'Construction', 'Foundation and concrete work'),
('Framing Contractors', 'Structure', 'Construction', 'Structural framing services'),
('Roofing Contractors', 'Envelope', 'Construction', 'Roofing installation and repair'),
('Plumbing Contractors', 'MEP', 'Construction', 'Plumbing installation and services'),
('Electrical Contractors', 'MEP', 'Construction', 'Electrical installation and services'),
('HVAC Contractors', 'MEP', 'Construction', 'Heating, ventilation, and air conditioning'),
('Flooring Contractors', 'Finishes', 'Construction', 'Flooring installation services'),
('Painting Contractors', 'Finishes', 'Construction', 'Interior and exterior painting'),
('Landscaping Contractors', 'Site Work', 'Construction', 'Landscaping and outdoor services')
ON CONFLICT (name) DO NOTHING;

-- Add requirements for Excavation Contractors
INSERT INTO public.vendor_category_requirements (category_id, requirement_name, requirement_description, data_type, is_required, measurement_unit, display_order, help_text, selection_options) 
SELECT vc.id, 'Cubic Yards to Excavate', 'Total volume of material to be excavated', 'number', true, 'cubic_yards', 1, 'Include all foundation, utility trenching, and site work excavation', NULL
FROM public.vendor_categories vc WHERE vc.name = 'Excavation Contractors'
UNION ALL
SELECT vc.id, 'Soil Type', 'Primary soil composition at excavation site', 'selection', true, NULL, 2, 'Select the predominant soil type', '{"options": ["clay", "sand", "rocky", "mixed", "loam"]}'::JSONB
FROM public.vendor_categories vc WHERE vc.name = 'Excavation Contractors'
UNION ALL
SELECT vc.id, 'Rock Presence', 'Indicates presence of rock requiring special equipment', 'boolean', true, NULL, 3, 'Check if rock excavation is required', NULL
FROM public.vendor_categories vc WHERE vc.name = 'Excavation Contractors'
UNION ALL
SELECT vc.id, 'Groundwater Level', 'Depth to groundwater table', 'number', false, 'feet', 4, 'Depth in feet below surface', NULL
FROM public.vendor_categories vc WHERE vc.name = 'Excavation Contractors';

-- Add requirements for Concrete Contractors
INSERT INTO public.vendor_category_requirements (category_id, requirement_name, requirement_description, data_type, is_required, measurement_unit, display_order, help_text, selection_options)
SELECT vc.id, 'Concrete PSI Required', 'Required compressive strength', 'number', true, 'psi', 1, 'Typically 3000-4000 PSI for residential foundations', NULL
FROM public.vendor_categories vc WHERE vc.name = 'Concrete Contractors'
UNION ALL
SELECT vc.id, 'Cubic Yards of Concrete', 'Total concrete volume needed', 'number', true, 'cubic_yards', 2, 'Calculate foundation, driveway, and walkway volumes', NULL
FROM public.vendor_categories vc WHERE vc.name = 'Concrete Contractors'
UNION ALL
SELECT vc.id, 'Finish Type', 'Surface finish requirements', 'selection', true, NULL, 3, 'Select the desired concrete finish', '{"options": ["smooth_trowel", "broom_finish", "stamped", "exposed_aggregate"]}'::JSONB
FROM public.vendor_categories vc WHERE vc.name = 'Concrete Contractors'
UNION ALL
SELECT vc.id, 'Rebar Requirements', 'Reinforcement specifications', 'text', true, NULL, 4, 'Specify rebar size, spacing, and grade', NULL
FROM public.vendor_categories vc WHERE vc.name = 'Concrete Contractors';

-- Add requirements for Framing Contractors
INSERT INTO public.vendor_category_requirements (category_id, requirement_name, requirement_description, data_type, is_required, measurement_unit, display_order, help_text, selection_options)
SELECT vc.id, 'Square Footage', 'Total square footage to frame', 'number', true, 'sq_ft', 1, 'Include all levels and covered porches', NULL
FROM public.vendor_categories vc WHERE vc.name = 'Framing Contractors'
UNION ALL
SELECT vc.id, 'Framing Type', 'Type of framing construction', 'selection', true, NULL, 2, 'Select primary framing method', '{"options": ["wood_stick", "engineered_lumber", "steel", "post_beam"]}'::JSONB
FROM public.vendor_categories vc WHERE vc.name = 'Framing Contractors'
UNION ALL
SELECT vc.id, 'Roof Complexity', 'Complexity level of roof design', 'selection', true, NULL, 3, 'Rate the complexity of the roof structure', '{"options": ["simple_gable", "hip_roof", "complex_multi_gable", "custom_design"]}'::JSONB
FROM public.vendor_categories vc WHERE vc.name = 'Framing Contractors';

-- Add requirements for Architects
INSERT INTO public.vendor_category_requirements (category_id, requirement_name, requirement_description, data_type, is_required, measurement_unit, display_order, help_text, selection_options)
SELECT vc.id, 'Project Square Footage', 'Total building square footage', 'number', true, 'sq_ft', 1, 'Include all heated and cooled spaces', NULL
FROM public.vendor_categories vc WHERE vc.name ILIKE '%architect%'
UNION ALL
SELECT vc.id, 'Architectural Style', 'Desired architectural style', 'selection', true, NULL, 2, 'Select the preferred architectural style', '{"options": ["traditional", "modern", "farmhouse", "craftsman", "colonial", "mediterranean", "custom"]}'::JSONB
FROM public.vendor_categories vc WHERE vc.name ILIKE '%architect%'
UNION ALL
SELECT vc.id, 'Number of Bedrooms', 'Total number of bedrooms', 'number', true, 'rooms', 3, 'Include all bedrooms and flex spaces', NULL
FROM public.vendor_categories vc WHERE vc.name ILIKE '%architect%'
UNION ALL
SELECT vc.id, 'Number of Bathrooms', 'Total number of full and half bathrooms', 'number', true, 'bathrooms', 4, 'Count full baths as 1, half baths as 0.5', NULL
FROM public.vendor_categories vc WHERE vc.name ILIKE '%architect%'
UNION ALL
SELECT vc.id, 'Special Features', 'Special architectural features or requirements', 'text', false, NULL, 5, 'Describe any unique features like home office, wine cellar, etc.', NULL
FROM public.vendor_categories vc WHERE vc.name ILIKE '%architect%';

-- Update completeness scores for existing bid requirements
UPDATE public.vendor_bid_requirements 
SET completeness_score = calculate_bid_completeness(id) 
WHERE completeness_score IS NULL;