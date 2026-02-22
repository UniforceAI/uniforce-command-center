
-- Create storage bucket for client logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('cliente-logos', 'cliente-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cliente-logos' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update their logos
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'cliente-logos' AND auth.uid() IS NOT NULL);

-- Allow public read access to logos
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'cliente-logos');

-- Allow authenticated users to delete logos
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'cliente-logos' AND auth.uid() IS NOT NULL);
