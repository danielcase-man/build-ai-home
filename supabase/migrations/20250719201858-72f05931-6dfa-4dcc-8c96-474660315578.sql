-- Migration 4 (Fixed): Performance Indexes, Utility Functions, and Sample Data

-- Enhanced indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_requirements_project_phase ON public.project_requirements(project_id, phase_id);
CREATE INDEX IF NOT EXISTS idx_project_requirements_category ON public.project_requirements(category_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_project_current ON public.project_documents(project_id, is_current_version) WHERE is_current_version = true;
CREATE INDEX IF NOT EXISTS idx_project_measurements_category ON public.project_measurements(project_id, measurement_category);
CREATE INDEX IF NOT EXISTS idx_vendor_bid_requirements_project ON public.vendor_bid_requirements(project_id, category_id);
CREATE INDEX IF NOT EXISTS idx_site_information_project ON public.site_information(project_id);
CREATE INDEX IF NOT EXISTS idx_building_specifications_project ON public.building_specifications(project_id);
CREATE INDEX IF NOT EXISTS idx_vendor_category_requirements_category ON public.vendor_category_requirements(category_id, display_order);

-- GIN indexes for JSONB columns to enable efficient JSON querying
CREATE INDEX IF NOT EXISTS idx_project_requirements_value_jsonb ON public.project_requirements USING GIN (value_jsonb);
CREATE INDEX IF NOT EXISTS idx_vendor_bid_requirements_responses ON public.vendor_bid_requirements USING GIN (requirement_responses);
CREATE INDEX IF NOT EXISTS idx_site_information_soil_conditions ON public.site_information USING GIN (soil_conditions);
CREATE INDEX IF NOT EXISTS idx_building_specifications_hvac ON public.building_specifications USING GIN (hvac_specifications);
CREATE INDEX IF NOT EXISTS idx_vendor_category_requirements_options ON public.vendor_category_requirements USING GIN (selection_options);

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