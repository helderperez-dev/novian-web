DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typnamespace = 'public'::regnamespace
          AND typname = 'property_offer_type'
    ) THEN
        CREATE TYPE public.property_offer_type AS ENUM ('sale', 'rent');
    END IF;
END
$$;

ALTER TABLE public.custom_fields
    ADD COLUMN IF NOT EXISTS field_key TEXT,
    ADD COLUMN IF NOT EXISTS unit TEXT,
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS show_on_property_card BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS show_on_property_page BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.custom_fields
SET field_key = trim(BOTH '_' FROM regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g'))
WHERE field_key IS NULL
   OR btrim(field_key) = '';

CREATE UNIQUE INDEX IF NOT EXISTS custom_fields_target_entity_field_key_idx
    ON public.custom_fields (target_entity, field_key)
    WHERE field_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.property_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    offer_type public.property_offer_type NOT NULL,
    price NUMERIC NOT NULL,
    owner_price NUMERIC,
    commission_rate NUMERIC,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT property_offers_price_non_negative CHECK (price >= 0),
    CONSTRAINT property_offers_owner_price_non_negative CHECK (owner_price IS NULL OR owner_price >= 0),
    CONSTRAINT property_offers_commission_rate_range CHECK (
        commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS property_offers_property_offer_type_idx
    ON public.property_offers (property_id, offer_type);

CREATE INDEX IF NOT EXISTS property_offers_property_primary_idx
    ON public.property_offers (property_id, is_primary DESC, offer_type);

INSERT INTO public.property_offers (
    property_id,
    offer_type,
    price,
    owner_price,
    commission_rate,
    is_primary
)
SELECT
    p.id,
    'sale'::public.property_offer_type,
    p.price,
    CASE
        WHEN jsonb_typeof(p.custom_data -> 'ownerPrice') = 'number' THEN (p.custom_data ->> 'ownerPrice')::NUMERIC
        WHEN jsonb_typeof(p.custom_data -> 'owner_price') = 'number' THEN (p.custom_data ->> 'owner_price')::NUMERIC
        ELSE NULL
    END,
    CASE
        WHEN jsonb_typeof(p.custom_data -> 'commissionRate') = 'number' THEN (p.custom_data ->> 'commissionRate')::NUMERIC
        WHEN jsonb_typeof(p.custom_data -> 'commission_rate') = 'number' THEN (p.custom_data ->> 'commission_rate')::NUMERIC
        ELSE NULL
    END,
    TRUE
FROM public.properties p
WHERE NOT EXISTS (
    SELECT 1
    FROM public.property_offers existing
    WHERE existing.property_id = p.id
      AND existing.offer_type = 'sale'::public.property_offer_type
);

UPDATE public.custom_fields
SET
    name = 'Área',
    type = 'number',
    unit = 'm²',
    sort_order = 10,
    show_on_property_card = true,
    show_on_property_page = true,
    required = false
WHERE target_entity = 'properties'
  AND field_key = 'area';

INSERT INTO public.custom_fields (
    name,
    type,
    target_entity,
    required,
    options,
    field_key,
    unit,
    sort_order,
    show_on_property_card,
    show_on_property_page
)
SELECT
    'Área', 'number', 'properties', false, NULL, 'area', 'm²', 10, true, true
WHERE NOT EXISTS (
    SELECT 1
    FROM public.custom_fields
    WHERE target_entity = 'properties'
      AND field_key = 'area'
);

UPDATE public.custom_fields
SET
    name = 'Quartos',
    type = 'number',
    unit = NULL,
    sort_order = 20,
    show_on_property_card = true,
    show_on_property_page = true,
    required = false
WHERE target_entity = 'properties'
  AND field_key = 'bedrooms';

INSERT INTO public.custom_fields (
    name,
    type,
    target_entity,
    required,
    options,
    field_key,
    unit,
    sort_order,
    show_on_property_card,
    show_on_property_page
)
SELECT
    'Quartos', 'number', 'properties', false, NULL, 'bedrooms', NULL, 20, true, true
WHERE NOT EXISTS (
    SELECT 1
    FROM public.custom_fields
    WHERE target_entity = 'properties'
      AND field_key = 'bedrooms'
);

UPDATE public.custom_fields
SET
    name = 'Vagas',
    type = 'number',
    unit = NULL,
    sort_order = 30,
    show_on_property_card = true,
    show_on_property_page = true,
    required = false
WHERE target_entity = 'properties'
  AND field_key = 'parking';

INSERT INTO public.custom_fields (
    name,
    type,
    target_entity,
    required,
    options,
    field_key,
    unit,
    sort_order,
    show_on_property_card,
    show_on_property_page
)
SELECT
    'Vagas', 'number', 'properties', false, NULL, 'parking', NULL, 30, true, true
WHERE NOT EXISTS (
    SELECT 1
    FROM public.custom_fields
    WHERE target_entity = 'properties'
      AND field_key = 'parking'
);

ALTER TABLE public.property_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_offers_public_read_active ON public.property_offers;
CREATE POLICY property_offers_public_read_active
    ON public.property_offers
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.properties p
            WHERE p.id = property_id
              AND (
                  p.status = 'active'::public.property_status
                  OR public.is_internal_user()
              )
        )
    );

DROP POLICY IF EXISTS property_offers_internal_insert ON public.property_offers;
CREATE POLICY property_offers_internal_insert
    ON public.property_offers
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS property_offers_internal_update ON public.property_offers;
CREATE POLICY property_offers_internal_update
    ON public.property_offers
    FOR UPDATE
    TO authenticated
    USING (public.is_internal_user())
    WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS property_offers_internal_delete ON public.property_offers;
CREATE POLICY property_offers_internal_delete
    ON public.property_offers
    FOR DELETE
    TO authenticated
    USING (public.is_internal_user());

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_fields_public_property_read ON public.custom_fields;
CREATE POLICY custom_fields_public_property_read
    ON public.custom_fields
    FOR SELECT
    TO anon, authenticated
    USING (
        target_entity = 'properties'
        OR public.is_internal_user()
    );

DROP POLICY IF EXISTS custom_fields_internal_insert ON public.custom_fields;
CREATE POLICY custom_fields_internal_insert
    ON public.custom_fields
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS custom_fields_internal_update ON public.custom_fields;
CREATE POLICY custom_fields_internal_update
    ON public.custom_fields
    FOR UPDATE
    TO authenticated
    USING (public.is_internal_user())
    WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS custom_fields_internal_delete ON public.custom_fields;
CREATE POLICY custom_fields_internal_delete
    ON public.custom_fields
    FOR DELETE
    TO authenticated
    USING (public.is_internal_user());
