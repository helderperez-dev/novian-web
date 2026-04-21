-- Insert new storage buckets (e.g., for lead attachments and user avatars)
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('attachments', 'attachments', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for 'attachments' bucket
-- Allow public read access
CREATE POLICY "Public Access for attachments" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'attachments');

-- Allow authenticated and anon inserts (for local testing)
CREATE POLICY "Public Uploads for attachments" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'attachments');

-- Allow authenticated and anon updates (for local testing)
CREATE POLICY "Public Updates for attachments" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'attachments');

-- Allow authenticated and anon deletes (for local testing)
CREATE POLICY "Public Deletes for attachments" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'attachments');


-- Policies for 'avatars' bucket
-- Allow public read access
CREATE POLICY "Public Access for avatars" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Allow authenticated and anon inserts (for local testing)
CREATE POLICY "Public Uploads for avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated and anon updates (for local testing)
CREATE POLICY "Public Updates for avatars" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars');

-- Allow authenticated and anon deletes (for local testing)
CREATE POLICY "Public Deletes for avatars" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'avatars');
