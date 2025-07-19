-- Migration 2: Project Requirements and Document Management System

-- Create project requirements tracking table
CREATE TABLE public.project_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.vendor_categories(id) ON DELETE CASCADE,
  
  -- Requirement Details
  requirement_name TEXT NOT NULL,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('measurement', 'specification', 'material', 'code_requirement')),
  
  -- Flexible Value Storage
  value_text TEXT,
  value_number NUMERIC(20,6),
  value_boolean BOOLEAN,
  value_date DATE,
  value_jsonb JSONB,
  value_file_id UUID,
  
  -- Metadata
  measurement_unit TEXT,
  is_required BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create project measurements table
CREATE TABLE public.project_measurements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id),
  
  -- Measurement Details
  measurement_category TEXT NOT NULL,
  measurement_name TEXT NOT NULL,
  measurement_value NUMERIC(20,6) NOT NULL,
  measurement_unit TEXT NOT NULL,
  
  -- Calculation Details
  calculation_method TEXT,
  source_document_id UUID,
  waste_factor NUMERIC(5,4) DEFAULT 0.10,
  total_with_waste NUMERIC(20,6),
  
  -- Quality Control
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  confidence_level TEXT DEFAULT 'estimated' CHECK (confidence_level IN ('estimated', 'measured', 'verified')),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Document categories configuration
CREATE TABLE public.document_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_type TEXT NOT NULL CHECK (category_type IN ('plans', 'permits', 'reports', 'photos', 'specifications')),
  required_for_phases TEXT[],
  file_types_allowed TEXT[] DEFAULT ARRAY['pdf', 'dwg', 'jpg', 'png', 'doc', 'docx', 'xlsx'],
  max_file_size_mb INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Project documents storage
CREATE TABLE public.project_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id),
  category_id UUID REFERENCES public.document_categories(id),
  
  -- Document Details
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT,
  
  -- File Information
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  
  -- Version Control
  version_number INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,
  supersedes_document_id UUID REFERENCES public.project_documents(id),
  
  -- Access Control
  uploaded_by UUID,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB,
  tags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for all new tables
ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for project requirements
CREATE POLICY "Project members can view requirements" 
ON public.project_requirements 
FOR SELECT 
USING (has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage requirements" 
ON public.project_requirements 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_requirements.project_id AND p.owner_id = auth.uid()
));

-- RLS policies for project measurements
CREATE POLICY "Project members can view measurements" 
ON public.project_measurements 
FOR SELECT 
USING (has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage measurements" 
ON public.project_measurements 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_measurements.project_id AND p.owner_id = auth.uid()
));

-- RLS policies for document categories (public read)
CREATE POLICY "Anyone can view document categories" 
ON public.document_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create document categories" 
ON public.document_categories 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS policies for project documents
CREATE POLICY "Project members can view documents" 
ON public.project_documents 
FOR SELECT 
USING (has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage documents" 
ON public.project_documents 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = project_documents.project_id AND p.owner_id = auth.uid()
));

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_project_requirements_updated_at
  BEFORE UPDATE ON public.project_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_measurements_updated_at
  BEFORE UPDATE ON public.project_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_documents_updated_at
  BEFORE UPDATE ON public.project_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert standard document categories
INSERT INTO public.document_categories (name, description, category_type, required_for_phases, file_types_allowed, max_file_size_mb) VALUES
('Architectural Plans', 'Complete architectural drawing sets', 'plans', ARRAY['design', 'permits', 'construction'], ARRAY['pdf', 'dwg', 'rvt'], 100),
('Structural Plans', 'Structural engineering drawings and calculations', 'plans', ARRAY['design', 'permits', 'construction'], ARRAY['pdf', 'dwg'], 50),
('Site Survey', 'Property boundary and topographic surveys', 'reports', ARRAY['planning', 'design'], ARRAY['pdf', 'dwg'], 25),
('Geotechnical Report', 'Soil conditions and foundation recommendations', 'reports', ARRAY['planning', 'design'], ARRAY['pdf'], 10),
('Building Permits', 'All building and trade permits', 'permits', ARRAY['permits', 'construction'], ARRAY['pdf'], 10),
('Progress Photos', 'Construction progress photography', 'photos', ARRAY['construction'], ARRAY['jpg', 'png', 'heic'], 25),
('Material Specifications', 'Product specifications and cut sheets', 'specifications', ARRAY['design', 'construction'], ARRAY['pdf'], 10);