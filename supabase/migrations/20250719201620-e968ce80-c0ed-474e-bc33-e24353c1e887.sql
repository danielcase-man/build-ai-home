-- Migration 3: Vendor Requirements System and Storage Configuration

-- Create vendor category requirements templates
CREATE TABLE public.vendor_category_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.vendor_categories(id) ON DELETE CASCADE,
  
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

-- Create vendor bid data collection table
CREATE TABLE public.vendor_bid_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.vendor_categories(id) ON DELETE CASCADE,
  
  -- Bid Information
  requirement_responses JSONB NOT NULL,
  bid_amount_low NUMERIC(12,2),
  bid_amount_high NUMERIC(12,2),
  bid_amount_preferred NUMERIC(12,2),
  
  -- Timeline and Terms
  estimated_duration_days INTEGER,
  earliest_start_date DATE,
  payment_terms TEXT,
  warranty_terms TEXT,
  
  -- Supporting Information
  documents_provided UUID[],
  references_provided JSONB,
  insurance_certificates UUID[],
  license_information JSONB,
  
  -- Bid Management
  submission_date TIMESTAMPTZ DEFAULT now(),
  bid_status TEXT DEFAULT 'submitted' CHECK (bid_status IN ('draft', 'submitted', 'under_review', 'accepted', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Quality Scoring
  completeness_score NUMERIC(3,2),
  qualification_score NUMERIC(3,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for new tables
ALTER TABLE public.vendor_category_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bid_requirements ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor category requirements (public read)
CREATE POLICY "Anyone can view vendor category requirements" 
ON public.vendor_category_requirements 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create category requirements" 
ON public.vendor_category_requirements 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update category requirements" 
ON public.vendor_category_requirements 
FOR UPDATE 
USING (true);

-- RLS policies for vendor bid requirements
CREATE POLICY "Project members can view bid requirements" 
ON public.vendor_bid_requirements 
FOR SELECT 
USING (has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage bid requirements" 
ON public.vendor_bid_requirements 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = vendor_bid_requirements.project_id AND p.owner_id = auth.uid()
));

-- Create storage buckets for document organization
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES 
  ('project-plans', 'project-plans', false, 104857600, ARRAY['application/pdf', 'application/dwg', 'image/jpeg', 'image/png']),
  ('project-photos', 'project-photos', false, 26214400, ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('project-permits', 'project-permits', false, 10485760, ARRAY['application/pdf']),
  ('project-reports', 'project-reports', false, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('vendor-documents', 'vendor-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('project-specifications', 'project-specifications', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for project documents
CREATE POLICY "Project members can access project documents" ON storage.objects
FOR ALL USING (
  bucket_id IN ('project-plans', 'project-photos', 'project-permits', 'project-reports', 'project-specifications') 
  AND EXISTS (
    SELECT 1 FROM public.project_members pm 
    WHERE pm.user_id = auth.uid() 
    AND pm.project_id::text = split_part(name, '/', 1)
  )
);

-- Allow project owners to manage all project documents  
CREATE POLICY "Project owners can manage all project documents" ON storage.objects
FOR ALL USING (
  bucket_id IN ('project-plans', 'project-photos', 'project-permits', 'project-reports', 'project-specifications')
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.owner_id = auth.uid() 
    AND p.id::text = split_part(name, '/', 1)
  )
);

-- Vendor document access policy
CREATE POLICY "Vendors can upload bid documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'vendor-documents'
  AND EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.project_id::text = split_part(name, '/', 1)
    AND v.email = auth.jwt() ->> 'email'
  )
);

-- Add trigger for updated_at timestamp
CREATE TRIGGER update_vendor_bid_requirements_updated_at
  BEFORE UPDATE ON public.vendor_bid_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();