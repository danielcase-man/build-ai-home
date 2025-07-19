-- Drop and recreate the projects INSERT policy with clearer logic
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;

-- Create a simpler INSERT policy for debugging
CREATE POLICY "Users can create projects" 
ON public.projects 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Also ensure there's a SELECT policy for reading created projects
DROP POLICY IF EXISTS "Project owners and members can view projects" ON public.projects;

CREATE POLICY "Project owners and members can view projects" 
ON public.projects 
FOR SELECT 
TO authenticated
USING (auth.uid() = owner_id OR has_project_access(id, auth.uid()));