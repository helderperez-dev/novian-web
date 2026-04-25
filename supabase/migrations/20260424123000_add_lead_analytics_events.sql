CREATE TABLE IF NOT EXISTS lead_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    event_category TEXT NOT NULL DEFAULT 'marketing',
    event_source TEXT NOT NULL DEFAULT 'website',
    event_channel TEXT,
    posthog_distinct_id TEXT,
    property_id TEXT,
    property_slug TEXT,
    property_title TEXT,
    property_price NUMERIC,
    property_city TEXT,
    current_url TEXT,
    pathname TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_analytics_events_lead_id_idx
    ON lead_analytics_events (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lead_analytics_events_person_id_idx
    ON lead_analytics_events (person_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lead_analytics_events_event_name_idx
    ON lead_analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS lead_analytics_events_property_slug_idx
    ON lead_analytics_events (property_slug);

CREATE INDEX IF NOT EXISTS lead_analytics_events_utm_campaign_idx
    ON lead_analytics_events (utm_campaign);
