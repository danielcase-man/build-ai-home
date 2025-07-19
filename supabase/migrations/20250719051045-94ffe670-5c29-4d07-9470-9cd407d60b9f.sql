-- Drop and recreate the INSERT policy to ensure it's working correctly
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;

-- Recreate with explicit authentication check
CREATE POLICY "Users can create projects" 
ON public.projects 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid() = owner_id
);