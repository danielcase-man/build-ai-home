-- Update RLS policies for vendor_categories to allow users to create categories for their projects

-- Allow authenticated users to insert vendor categories
CREATE POLICY "Users can create vendor categories"
ON vendor_categories
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update vendor categories  
CREATE POLICY "Users can update vendor categories"
ON vendor_categories
FOR UPDATE
TO authenticated
USING (true);