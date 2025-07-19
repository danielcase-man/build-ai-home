-- Fix the RLS policy for projects to ensure it works with client authentication
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;

-- Create a more robust policy that handles authentication properly
CREATE POLICY "Users can create projects" 
ON public.projects 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = owner_id);