CREATE TABLE IF NOT EXISTS public.person_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT person_properties_relationship_type_check
        CHECK (relationship_type IN ('interested', 'owner'))
);

COMMENT ON TABLE public.person_properties IS 'Associates people with properties they own or are interested in.';

CREATE UNIQUE INDEX IF NOT EXISTS person_properties_person_property_relationship_idx
    ON public.person_properties (person_id, property_id, relationship_type);

CREATE INDEX IF NOT EXISTS person_properties_person_idx
    ON public.person_properties (person_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS person_properties_property_idx
    ON public.person_properties (property_id, updated_at DESC);

ALTER TABLE public.person_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_properties_internal_select ON public.person_properties;
CREATE POLICY person_properties_internal_select
    ON public.person_properties
    FOR SELECT
    TO authenticated
    USING (public.is_internal_user());

DROP POLICY IF EXISTS person_properties_internal_insert ON public.person_properties;
CREATE POLICY person_properties_internal_insert
    ON public.person_properties
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS person_properties_internal_update ON public.person_properties;
CREATE POLICY person_properties_internal_update
    ON public.person_properties
    FOR UPDATE
    TO authenticated
    USING (public.is_internal_user())
    WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS person_properties_internal_delete ON public.person_properties;
CREATE POLICY person_properties_internal_delete
    ON public.person_properties
    FOR DELETE
    TO authenticated
    USING (public.is_internal_user());
