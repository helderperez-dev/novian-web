CREATE OR REPLACE FUNCTION public.sync_person_from_lead_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    resolved_person public.people%ROWTYPE;
    normalized_phone TEXT;
    normalized_email TEXT;
    normalized_source TEXT;
    normalized_name TEXT;
    merged_metadata JSONB;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    normalized_phone := NULLIF(btrim(NEW.phone), '');
    normalized_email := NULLIF(lower(btrim(COALESCE(NEW.custom_data ->> 'email', ''))), '');
    normalized_source := COALESCE(
        NULLIF(btrim(COALESCE(NEW.custom_data ->> 'source', NEW.custom_data ->> 'origin', '')), ''),
        'lead'
    );
    normalized_name := CASE
        WHEN COALESCE(NULLIF(btrim(NEW.name), ''), '') = '' THEN COALESCE(CONCAT('Contato ', normalized_phone), 'Contato sem nome')
        WHEN lower(btrim(NEW.name)) = 'lead' THEN COALESCE(CONCAT('Contato ', normalized_phone), 'Contato sem nome')
        ELSE btrim(NEW.name)
    END;
    merged_metadata := COALESCE(NEW.custom_data, '{}'::JSONB) || jsonb_build_object(
        'lead_id', NEW.id,
        'lead_status', NEW.status,
        'lead_funnel_id', NEW.funnel_id,
        'lead_preview', NEW.preview
    );

    IF NEW.person_id IS NOT NULL THEN
        SELECT *
        INTO resolved_person
        FROM public.people
        WHERE id = NEW.person_id;
    END IF;

    IF resolved_person.id IS NULL AND normalized_phone IS NOT NULL THEN
        SELECT *
        INTO resolved_person
        FROM public.people
        WHERE primary_phone = normalized_phone
        LIMIT 1;
    END IF;

    IF resolved_person.id IS NULL AND normalized_email IS NOT NULL THEN
        SELECT *
        INTO resolved_person
        FROM public.people
        WHERE lower(email) = normalized_email
        LIMIT 1;
    END IF;

    IF resolved_person.id IS NULL THEN
        INSERT INTO public.people (
            full_name,
            primary_phone,
            email,
            roles,
            tags,
            origin,
            stage_points,
            metadata,
            last_interaction_preview,
            created_at,
            updated_at
        )
        VALUES (
            normalized_name,
            normalized_phone,
            normalized_email,
            ARRAY['lead']::public.person_role[],
            ARRAY[]::TEXT[],
            normalized_source,
            COALESCE(NEW.score, 0),
            merged_metadata,
            NEW.preview,
            COALESCE(NEW.created_at, NOW()),
            COALESCE(NEW.updated_at, NOW())
        )
        RETURNING *
        INTO resolved_person;
    ELSE
        UPDATE public.people
        SET
            full_name = COALESCE(normalized_name, resolved_person.full_name),
            primary_phone = COALESCE(normalized_phone, resolved_person.primary_phone),
            email = COALESCE(normalized_email, resolved_person.email),
            roles = ARRAY(
                SELECT DISTINCT role_item
                FROM unnest(COALESCE(resolved_person.roles, ARRAY[]::public.person_role[]) || ARRAY['lead'::public.person_role]) AS role_item
            ),
            origin = COALESCE(NULLIF(btrim(resolved_person.origin), ''), normalized_source),
            stage_points = GREATEST(COALESCE(resolved_person.stage_points, 0), COALESCE(NEW.score, 0)),
            metadata = COALESCE(resolved_person.metadata, '{}'::JSONB) || merged_metadata,
            last_interaction_preview = COALESCE(NEW.preview, resolved_person.last_interaction_preview),
            updated_at = NOW()
        WHERE id = resolved_person.id
        RETURNING *
        INTO resolved_person;
    END IF;

    NEW.person_id := resolved_person.id;
    NEW.name := COALESCE(resolved_person.full_name, normalized_name, NEW.name);
    NEW.phone := COALESCE(resolved_person.primary_phone, normalized_phone, NEW.phone);
    NEW.custom_data := COALESCE(NEW.custom_data, '{}'::JSONB) || jsonb_strip_nulls(
        jsonb_build_object(
            'email', COALESCE(normalized_email, resolved_person.email),
            'source', COALESCE(normalized_source, resolved_person.origin)
        )
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_person_before_write ON public.leads;

CREATE TRIGGER leads_sync_person_before_write
BEFORE INSERT OR UPDATE OF person_id, name, phone, status, score, funnel_id, preview, custom_data
ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_person_from_lead_row();

CREATE OR REPLACE FUNCTION public.sync_leads_from_person_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    UPDATE public.leads
    SET
        name = COALESCE(NULLIF(btrim(NEW.full_name), ''), name),
        phone = COALESCE(NULLIF(btrim(NEW.primary_phone), ''), phone),
        preview = COALESCE(NEW.last_interaction_preview, preview),
        custom_data = COALESCE(custom_data, '{}'::JSONB) || jsonb_strip_nulls(
            jsonb_build_object(
                'email', NULLIF(lower(btrim(COALESCE(NEW.email, ''))), ''),
                'source', NULLIF(btrim(COALESCE(NEW.origin, '')), '')
            )
        ),
        updated_at = NOW()
    WHERE person_id = NEW.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_sync_leads_after_update ON public.people;

CREATE TRIGGER people_sync_leads_after_update
AFTER UPDATE OF full_name, primary_phone, email, origin, last_interaction_preview
ON public.people
FOR EACH ROW
EXECUTE FUNCTION public.sync_leads_from_person_row();

UPDATE public.leads
SET
    name = name,
    phone = phone,
    preview = preview,
    custom_data = COALESCE(custom_data, '{}'::JSONB);

COMMENT ON TABLE public.people IS 'Canonical person records for all contact types.';
COMMENT ON TABLE public.leads IS 'CRM lifecycle records linked to canonical people.';
COMMENT ON COLUMN public.leads.name IS 'Duplicated from people.full_name for backwards compatibility.';
COMMENT ON COLUMN public.leads.phone IS 'Duplicated from people.primary_phone for backwards compatibility.';
COMMENT ON COLUMN public.leads.person_id IS 'Canonical person linked to this CRM lead lifecycle record.';
