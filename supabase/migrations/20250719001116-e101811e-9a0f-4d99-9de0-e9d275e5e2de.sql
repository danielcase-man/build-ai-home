-- Create vendor categories table
CREATE TABLE public.vendor_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  phase TEXT NOT NULL, -- pre_construction, site_preparation, etc.
  category TEXT NOT NULL, -- professional_services, regulatory_and_legal, etc.
  subcategory TEXT, -- architects, engineers, etc.
  typical_cost TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.vendor_categories(id),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER,
  cost_estimate_low DECIMAL(10,2),
  cost_estimate_avg DECIMAL(10,2),
  cost_estimate_high DECIMAL(10,2),
  notes TEXT,
  status TEXT DEFAULT 'researched', -- researched, contacted, quoted, selected, contracted
  ai_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project phases table for timeline management
CREATE TABLE public.project_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  phase_order INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  estimated_duration_days INTEGER,
  status TEXT DEFAULT 'not_started', -- not_started, in_progress, completed, delayed
  dependencies TEXT[], -- array of phase IDs this depends on
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project tasks table
CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed_date DATE,
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, blocked
  assigned_to TEXT,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Vendor categories policies (public read, admin write)
CREATE POLICY "Anyone can view vendor categories" 
ON public.vendor_categories 
FOR SELECT 
USING (true);

-- Vendors policies
CREATE POLICY "Project members can view vendors" 
ON public.vendors 
FOR SELECT 
USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage vendors" 
ON public.vendors 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  )
);

-- Project phases policies
CREATE POLICY "Project members can view phases" 
ON public.project_phases 
FOR SELECT 
USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage phases" 
ON public.project_phases 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  )
);

-- Project tasks policies
CREATE POLICY "Project members can view tasks" 
ON public.project_tasks 
FOR SELECT 
USING (public.has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage tasks" 
ON public.project_tasks 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  )
);

-- Add updated_at triggers
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_phases_updated_at
  BEFORE UPDATE ON public.project_phases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default vendor categories based on the comprehensive structure
INSERT INTO public.vendor_categories (name, description, phase, category, subcategory, typical_cost) VALUES
('Architects', 'Design home structure, style, and create blueprints', 'pre_construction', 'professional_services', 'architects', '$125-$250 per hour'),
('Structural Engineers', 'Structural, civil, and MEP engineering', 'pre_construction', 'professional_services', 'engineers', '$100-$200 per hour'),
('Interior Designers', 'Interior layout and design services', 'pre_construction', 'professional_services', 'interior_designers', '$50-$200 per hour'),
('Land Surveyors', 'Site surveying and property boundaries', 'pre_construction', 'professional_services', 'land_surveyors', '$500-$2000 per survey'),
('Building Permit Authorities', 'Government entities issuing building permits', 'pre_construction', 'regulatory_and_legal', 'permit_authorities', 'Varies by jurisdiction'),
('Construction Attorneys', 'Construction law and contract services', 'pre_construction', 'regulatory_and_legal', 'legal_services', '$200-$500 per hour'),
('Geotechnical Testing', 'Geotechnical and soil analysis', 'pre_construction', 'testing_and_inspection', 'soil_testing', '$1500-$5000'),
('Excavation Contractors', 'Site clearing and excavation services', 'site_preparation', 'site_work_contractors', 'excavation_contractors', '$40-$150 per hour'),
('Utility Contractors', 'Underground utility installation', 'site_preparation', 'site_work_contractors', 'utility_contractors', 'Varies by scope'),
('Concrete Contractors', 'Foundation and concrete work', 'foundation_and_structure', 'foundation_contractors', 'concrete_contractors', '$2-$3 per square foot'),
('House Framers', 'Structural framing and carpentry', 'foundation_and_structure', 'framing_contractors', 'house_framers', '$7-$16 per square foot'),
('Lumber Suppliers', 'Structural lumber and building materials', 'foundation_and_structure', 'material_suppliers', 'lumber_suppliers', 'Market rates'),
('Roofing Contractors', 'Roof installation and repair', 'exterior_envelope', 'roofing', 'roofing_contractors', '$5,700-$12,000'),
('Siding Contractors', 'Exterior siding installation', 'exterior_envelope', 'siding_and_exterior', 'siding_contractors', 'Varies by material'),
('Window Installers', 'Window and door installation', 'exterior_envelope', 'windows_and_doors', 'window_contractors', 'Varies by scope'),
('Electricians', 'Electrical installation and service', 'mechanical_systems', 'electrical', 'electrical_contractors', '$50-$100 per hour'),
('Plumbers', 'Plumbing installation and service', 'mechanical_systems', 'plumbing', 'plumbing_contractors', '$7,500-$15,000'),
('HVAC Contractors', 'Heating, ventilation, and air conditioning', 'mechanical_systems', 'hvac', 'hvac_contractors', '$5,000-$10,000'),
('Drywall Contractors', 'Drywall installation and finishing', 'interior_finishes', 'drywall_and_insulation', 'drywall_contractors', '$5,000-$30,000'),
('Flooring Contractors', 'Floor installation services', 'interior_finishes', 'flooring', 'flooring_contractors', '$10,000-$35,000'),
('Cabinet Installers', 'Cabinet installation and custom work', 'interior_finishes', 'cabinetry_and_countertops', 'cabinet_contractors', 'Varies by scope'),
('Painting Contractors', 'Interior and exterior painting', 'interior_finishes', 'painting_and_finishes', 'painting_contractors', '$5,800-$15,000'),
('Trim Contractors', 'Finish carpentry and trim work', 'interior_finishes', 'trim_and_millwork', 'trim_contractors', '$8,000-$29,600'),
('Electric Utilities', 'Electrical grid connection and service', 'utilities_and_infrastructure', 'utility_providers', 'electrical_utilities', 'Connection fees vary'),
('Water Utilities', 'Water supply and connection', 'utilities_and_infrastructure', 'utility_providers', 'water_utilities', 'Connection fees vary'),
('Landscaping Contractors', 'Landscape design and installation', 'landscaping_and_exterior', 'landscaping', 'landscaping_contractors', '$50-$100 per hour'),
('General Contractors', 'Overall project management and coordination', 'project_management_and_oversight', 'general_contractors', 'residential_builders', '10-20% of total cost'),
('Building Inspectors', 'Code compliance and safety inspections', 'project_management_and_oversight', 'inspection_services', 'building_inspectors', '$300-$500 per inspection'),
('Construction Lenders', 'Construction and permanent financing', 'financial_and_insurance_services', 'financing', 'construction_lenders', 'Interest rates vary'),
('Smart Home Contractors', 'Home automation and technology', 'specialty_services', 'technology_systems', 'smart_home_contractors', 'Varies by scope');