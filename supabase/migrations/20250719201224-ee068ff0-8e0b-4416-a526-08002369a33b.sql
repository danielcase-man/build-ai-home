-- Migration 1: Enhanced Projects Table and Core Site Information
-- Add comprehensive project details to existing projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS lot_size_acres NUMERIC(10,4);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS square_footage NUMERIC(10,2);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS stories INTEGER;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS bathrooms NUMERIC(3,1);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS architectural_style TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'custom_home';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS timeline JSONB;

-- Add check constraints
ALTER TABLE public.projects ADD CONSTRAINT valid_project_status 
  CHECK (status IN ('planning', 'design', 'permits', 'construction', 'completed', 'on_hold'));
ALTER TABLE public.projects ADD CONSTRAINT valid_project_type 
  CHECK (project_type IN ('custom_home', 'production_home', 'renovation', 'addition'));

-- Create site information table
CREATE TABLE public.site_information (
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

-- Enable RLS for site information
ALTER TABLE public.site_information ENABLE ROW LEVEL SECURITY;

-- RLS policies for site information
CREATE POLICY "Project members can view site information" 
ON public.site_information 
FOR SELECT 
USING (has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage site information" 
ON public.site_information 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = site_information.project_id AND p.owner_id = auth.uid()
));

-- Create building specifications table
CREATE TABLE public.building_specifications (
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

-- Enable RLS for building specifications
ALTER TABLE public.building_specifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for building specifications
CREATE POLICY "Project members can view building specifications" 
ON public.building_specifications 
FOR SELECT 
USING (has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage building specifications" 
ON public.building_specifications 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = building_specifications.project_id AND p.owner_id = auth.uid()
));

-- Add trigger for updated_at timestamps
CREATE TRIGGER update_site_information_updated_at
  BEFORE UPDATE ON public.site_information
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_building_specifications_updated_at
  BEFORE UPDATE ON public.building_specifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();