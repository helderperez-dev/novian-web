INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

CREATE OR REPLACE FUNCTION public.is_internal_active_app_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE id = auth.uid()
      AND is_active = true
      AND user_type = 'internal'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_internal_active_app_user() TO authenticated;

DROP POLICY IF EXISTS "Internal document uploads" ON storage.objects;
CREATE POLICY "Internal document uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_internal_active_app_user()
);

DROP POLICY IF EXISTS "Internal document cleanup" ON storage.objects;
CREATE POLICY "Internal document cleanup"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_internal_active_app_user()
);
