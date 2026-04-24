CREATE TYPE person_role AS ENUM ('lead', 'client', 'buyer', 'seller');

CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    primary_phone TEXT,
    email TEXT,
    roles person_role[] NOT NULL DEFAULT ARRAY['lead']::person_role[],
    tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    origin TEXT DEFAULT 'manual',
    stage_points INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    last_interaction_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX people_primary_phone_unique_idx
    ON people (primary_phone)
    WHERE primary_phone IS NOT NULL AND btrim(primary_phone) <> '';

CREATE UNIQUE INDEX people_email_unique_idx
    ON people (lower(email))
    WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE INDEX people_roles_gin_idx ON people USING GIN (roles);
CREATE INDEX people_tags_gin_idx ON people USING GIN (tags);

ALTER TABLE leads
    ADD COLUMN person_id UUID REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX leads_person_id_idx ON leads (person_id);

CREATE TABLE funnel_stage_people_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES funnel_stages(id) ON DELETE CASCADE,
    stage_title TEXT NOT NULL,
    add_roles person_role[] NOT NULL DEFAULT ARRAY[]::person_role[],
    remove_roles person_role[] NOT NULL DEFAULT ARRAY[]::person_role[],
    add_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    remove_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    points_delta INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT funnel_stage_people_rules_unique_stage UNIQUE (funnel_id, stage_title)
);

CREATE INDEX funnel_stage_people_rules_funnel_id_idx ON funnel_stage_people_rules (funnel_id);

WITH source_people AS (
    SELECT
        l.id AS lead_id,
        gen_random_uuid() AS person_id,
        CASE
            WHEN COALESCE(NULLIF(btrim(l.name), ''), '') = '' THEN CONCAT('Contato ', l.phone)
            WHEN lower(l.name) = 'lead' THEN CONCAT('Contato ', l.phone)
            ELSE l.name
        END AS full_name,
        NULLIF(btrim(l.phone), '') AS primary_phone,
        NULLIF(btrim(COALESCE(l.custom_data ->> 'email', '')), '') AS email,
        COALESCE(NULLIF(btrim(l.custom_data ->> 'source'), ''), 'lead') AS origin,
        COALESCE(l.score, 0) AS stage_points,
        COALESCE(l.custom_data, '{}'::JSONB) || jsonb_build_object(
            'lead_status', l.status,
            'lead_funnel_id', l.funnel_id,
            'lead_preview', l.preview
        ) AS metadata,
        l.preview AS last_interaction_preview,
        COALESCE(l.created_at, NOW()) AS created_at,
        COALESCE(l.updated_at, NOW()) AS updated_at
    FROM leads l
)
INSERT INTO people (
    id,
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
SELECT
    person_id,
    full_name,
    primary_phone,
    email,
    ARRAY['lead']::person_role[],
    CASE
        WHEN metadata ->> 'lead_status' IS NOT NULL AND btrim(metadata ->> 'lead_status') <> '' THEN ARRAY[lower(regexp_replace(metadata ->> 'lead_status', '[^a-zA-Z0-9]+', '-', 'g'))]
        ELSE ARRAY[]::TEXT[]
    END,
    origin,
    stage_points,
    metadata,
    last_interaction_preview,
    created_at,
    updated_at
FROM source_people;

WITH source_people AS (
    SELECT
        l.id AS lead_id,
        p.id AS person_id
    FROM leads l
    JOIN people p
      ON p.primary_phone IS NOT DISTINCT FROM NULLIF(btrim(l.phone), '')
     AND p.email IS NOT DISTINCT FROM NULLIF(btrim(COALESCE(l.custom_data ->> 'email', '')), '')
)
UPDATE leads l
SET person_id = source_people.person_id
FROM source_people
WHERE l.id = source_people.lead_id;

INSERT INTO custom_fields (name, type, target_entity, required, options)
VALUES
    ('E-mail', 'text', 'people', false, NULL),
    ('Cidade de Interesse', 'text', 'people', false, NULL),
    ('Faixa de Orçamento', 'number', 'people', false, NULL),
    ('Origem do Contato', 'dropdown', 'people', false, ARRAY['WhatsApp', 'Website', 'Indicação', 'Manual'])
ON CONFLICT DO NOTHING;

INSERT INTO funnel_stage_people_rules (
    funnel_id,
    stage_id,
    stage_title,
    add_roles,
    add_tags,
    points_delta
)
SELECT
    fs.funnel_id,
    fs.id,
    fs.title,
    CASE
        WHEN lower(fs.title) IN ('novo lead', 'new lead', 'novo') THEN ARRAY['lead']::person_role[]
        WHEN lower(fs.title) IN ('fechado', 'closed won', 'closed_won', 'cliente') THEN ARRAY['client']::person_role[]
        ELSE ARRAY[]::person_role[]
    END,
    CASE
        WHEN lower(fs.title) IN ('qualificação', 'qualificacao', 'qualified') THEN ARRAY['qualified']
        WHEN lower(fs.title) IN ('atendimento', 'visiting') THEN ARRAY['engaged']
        WHEN lower(fs.title) IN ('proposta', 'negotiating') THEN ARRAY['proposal']
        WHEN lower(fs.title) IN ('fechado', 'closed won', 'closed_won', 'cliente') THEN ARRAY['client-active']
        ELSE ARRAY[]::TEXT[]
    END,
    CASE
        WHEN lower(fs.title) IN ('qualificação', 'qualificacao', 'qualified') THEN 10
        WHEN lower(fs.title) IN ('atendimento', 'visiting') THEN 15
        WHEN lower(fs.title) IN ('proposta', 'negotiating') THEN 25
        WHEN lower(fs.title) IN ('fechado', 'closed won', 'closed_won', 'cliente') THEN 50
        ELSE 0
    END
FROM funnel_stages fs
JOIN funnels f ON f.id = fs.funnel_id
WHERE f.type = 'lead'
ON CONFLICT (funnel_id, stage_title) DO NOTHING;
