ALTER TABLE public.people
    ADD COLUMN IF NOT EXISTS crm_status TEXT;

ALTER TABLE public.people
    ADD COLUMN IF NOT EXISTS crm_funnel_id UUID;

ALTER TABLE public.people
    ADD COLUMN IF NOT EXISTS crm_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.people
    ADD COLUMN IF NOT EXISTS crm_unread BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'people_crm_funnel_id_fkey'
    ) THEN
        ALTER TABLE public.people
            ADD CONSTRAINT people_crm_funnel_id_fkey
            FOREIGN KEY (crm_funnel_id) REFERENCES public.funnels(id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS people_crm_funnel_id_idx
    ON public.people (crm_funnel_id);

UPDATE public.leads l
SET person_id = p.id
FROM public.people p
WHERE l.person_id IS NULL
  AND (
        (
            NULLIF(btrim(l.phone), '') IS NOT NULL
            AND p.primary_phone = NULLIF(btrim(l.phone), '')
        )
        OR (
            NULLIF(lower(btrim(COALESCE(l.custom_data ->> 'email', ''))), '') IS NOT NULL
            AND lower(p.email) = NULLIF(lower(btrim(COALESCE(l.custom_data ->> 'email', ''))), '')
        )
    );

UPDATE public.people p
SET
    full_name = COALESCE(NULLIF(btrim(l.name), ''), p.full_name),
    primary_phone = COALESCE(NULLIF(btrim(l.phone), ''), p.primary_phone),
    email = COALESCE(NULLIF(lower(btrim(COALESCE(l.custom_data ->> 'email', ''))), ''), p.email),
    roles = ARRAY(
        SELECT DISTINCT role_item
        FROM unnest(COALESCE(p.roles, ARRAY[]::public.person_role[]) || ARRAY['lead'::public.person_role]) AS role_item
    ),
    origin = COALESCE(NULLIF(btrim(COALESCE(l.custom_data ->> 'source', l.custom_data ->> 'origin', '')), ''), p.origin, 'lead'),
    stage_points = GREATEST(COALESCE(p.stage_points, 0), COALESCE(l.score, 0), COALESCE(p.crm_score, 0)),
    metadata = COALESCE(p.metadata, '{}'::JSONB) || COALESCE(l.custom_data, '{}'::JSONB),
    last_interaction_preview = COALESCE(NULLIF(btrim(l.preview), ''), p.last_interaction_preview),
    crm_status = COALESCE(NULLIF(btrim(l.status), ''), p.crm_status),
    crm_funnel_id = COALESCE(l.funnel_id, p.crm_funnel_id),
    crm_score = GREATEST(COALESCE(p.crm_score, 0), COALESCE(l.score, 0)),
    crm_unread = COALESCE(l.unread, p.crm_unread, FALSE),
    updated_at = GREATEST(COALESCE(p.updated_at, NOW()), COALESCE(l.updated_at, NOW()))
FROM public.leads l
WHERE l.person_id = p.id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'messages'
    ) THEN
        ALTER TABLE public.messages
            ADD COLUMN IF NOT EXISTS person_id UUID;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'messages_person_id_fkey'
        ) THEN
            ALTER TABLE public.messages
                ADD CONSTRAINT messages_person_id_fkey
                FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;
        END IF;

        UPDATE public.messages message_row
        SET person_id = l.person_id
        FROM public.leads l
        WHERE message_row.person_id IS NULL
          AND message_row.lead_id = l.id;
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'messages'
    ) THEN
        CREATE INDEX IF NOT EXISTS messages_person_id_idx
            ON public.messages (person_id);
    END IF;
END
$$;

ALTER TABLE IF EXISTS public.messages
    DROP CONSTRAINT IF EXISTS messages_lead_id_fkey;

ALTER TABLE IF EXISTS public.messages
    DROP COLUMN IF EXISTS lead_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'chat_threads'
    ) THEN
        ALTER TABLE public.chat_threads
            ADD COLUMN IF NOT EXISTS person_id UUID;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'chat_threads_person_id_fkey'
        ) THEN
            ALTER TABLE public.chat_threads
                ADD CONSTRAINT chat_threads_person_id_fkey
                FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;
        END IF;

        UPDATE public.chat_threads thread_row
        SET person_id = l.person_id
        FROM public.leads l
        WHERE thread_row.person_id IS NULL
          AND thread_row.lead_id = l.id;

        UPDATE public.chat_threads thread_row
        SET person_id = p.id
        FROM public.people p
        WHERE thread_row.person_id IS NULL
          AND thread_row.phone IS NOT NULL
          AND p.primary_phone = NULLIF(btrim(thread_row.phone), '');
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'chat_threads'
    ) THEN
        CREATE INDEX IF NOT EXISTS chat_threads_person_id_idx
            ON public.chat_threads (person_id);
    END IF;
END
$$;

ALTER TABLE IF EXISTS public.chat_threads
    DROP CONSTRAINT IF EXISTS chat_threads_lead_id_fkey;

ALTER TABLE IF EXISTS public.chat_threads
    DROP COLUMN IF EXISTS lead_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'lead_analytics_events'
    ) THEN
        ALTER TABLE public.lead_analytics_events
            ADD COLUMN IF NOT EXISTS person_id UUID;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'lead_analytics_events_person_id_fkey'
        ) THEN
            ALTER TABLE public.lead_analytics_events
                ADD CONSTRAINT lead_analytics_events_person_id_fkey
                FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;
        END IF;

        UPDATE public.lead_analytics_events event_row
        SET person_id = l.person_id
        FROM public.leads l
        WHERE event_row.person_id IS NULL
          AND event_row.lead_id = l.id;
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'lead_analytics_events'
    ) THEN
        CREATE INDEX IF NOT EXISTS lead_analytics_events_person_id_idx
            ON public.lead_analytics_events (person_id, created_at DESC);
    END IF;
END
$$;

DROP INDEX IF EXISTS public.lead_analytics_events_lead_id_idx;

ALTER TABLE IF EXISTS public.lead_analytics_events
    DROP CONSTRAINT IF EXISTS lead_analytics_events_lead_id_fkey;

ALTER TABLE IF EXISTS public.lead_analytics_events
    DROP COLUMN IF EXISTS lead_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'external_messages'
    ) THEN
        ALTER TABLE public.external_messages
            ADD COLUMN IF NOT EXISTS person_id UUID;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'external_messages_person_id_fkey'
        ) THEN
            ALTER TABLE public.external_messages
                ADD CONSTRAINT external_messages_person_id_fkey
                FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;
        END IF;

        UPDATE public.external_messages external_message
        SET person_id = l.person_id
        FROM public.leads l
        WHERE external_message.person_id IS NULL
          AND external_message.lead_id = l.id;
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'external_messages'
    ) THEN
        CREATE INDEX IF NOT EXISTS external_messages_person_id_idx
            ON public.external_messages (person_id);
    END IF;
END
$$;

ALTER TABLE IF EXISTS public.external_messages
    DROP CONSTRAINT IF EXISTS external_messages_lead_id_fkey;

ALTER TABLE IF EXISTS public.external_messages
    DROP COLUMN IF EXISTS lead_id;

DROP TRIGGER IF EXISTS leads_sync_person_before_write ON public.leads;
DROP TRIGGER IF EXISTS people_sync_leads_after_update ON public.people;

DROP FUNCTION IF EXISTS public.sync_person_from_lead_row();
DROP FUNCTION IF EXISTS public.sync_leads_from_person_row();

DROP TABLE IF EXISTS public.leads;
