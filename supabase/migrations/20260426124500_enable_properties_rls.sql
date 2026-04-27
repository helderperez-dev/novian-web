ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS properties_public_read_active ON public.properties;
CREATE POLICY properties_public_read_active
    ON public.properties
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'active'::public.property_status
        OR public.is_internal_user()
    );

DROP POLICY IF EXISTS properties_internal_insert ON public.properties;
CREATE POLICY properties_internal_insert
    ON public.properties
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS properties_internal_update ON public.properties;
CREATE POLICY properties_internal_update
    ON public.properties
    FOR UPDATE
    TO authenticated
    USING (public.is_internal_user())
    WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS properties_internal_delete ON public.properties;
CREATE POLICY properties_internal_delete
    ON public.properties
    FOR DELETE
    TO authenticated
    USING (public.is_internal_user());
