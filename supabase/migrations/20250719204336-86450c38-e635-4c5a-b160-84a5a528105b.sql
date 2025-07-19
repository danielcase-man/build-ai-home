-- Create a staging table for raw research results
CREATE TABLE public.vendor_research_staging (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  category_name TEXT NOT NULL,
  search_query TEXT NOT NULL,
  raw_firecrawl_data JSONB NOT NULL,
  extracted_vendors JSONB,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  processing_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.vendor_research_staging ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Project members can view research staging" 
ON public.vendor_research_staging 
FOR SELECT 
USING (has_project_access(project_id, auth.uid()));

CREATE POLICY "Project owners can manage research staging" 
ON public.vendor_research_staging 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = vendor_research_staging.project_id AND p.owner_id = auth.uid()
));