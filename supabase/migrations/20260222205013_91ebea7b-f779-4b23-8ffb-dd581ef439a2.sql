-- Fix RLS policies for cliente-logos bucket
-- The app authenticates via external Supabase, so auth.uid() is NULL on Lovable Cloud
-- Allow public uploads/updates to this specific bucket (logos are already publicly readable)

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

CREATE POLICY "Anyone can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cliente-logos');

CREATE POLICY "Anyone can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'cliente-logos');

CREATE POLICY "Anyone can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'cliente-logos');