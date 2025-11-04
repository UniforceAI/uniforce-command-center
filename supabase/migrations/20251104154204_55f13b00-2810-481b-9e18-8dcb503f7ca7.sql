-- Drop all existing public policies on chamados table
DROP POLICY IF EXISTS "Allow public read access to chamados" ON chamados;
DROP POLICY IF EXISTS "Allow public insert to chamados" ON chamados;
DROP POLICY IF EXISTS "Allow public update to chamados" ON chamados;
DROP POLICY IF EXISTS "Allow public delete from chamados" ON chamados;

-- Create secure policies requiring authentication
-- Only authenticated users can read chamados
CREATE POLICY "Authenticated users can view chamados"
ON chamados FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Only authenticated users can insert chamados (for webhook via service role)
CREATE POLICY "Service role can insert chamados"
ON chamados FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Only authenticated users can update chamados
CREATE POLICY "Service role can update chamados"
ON chamados FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Only admin role can delete chamados
CREATE POLICY "Admins can delete chamados"
ON chamados FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Update profiles table policy to require authentication
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Authenticated users can view profiles"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);