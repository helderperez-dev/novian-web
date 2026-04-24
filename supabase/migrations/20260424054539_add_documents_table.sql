CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_extension TEXT,
    mime_type TEXT,
    file_size_bytes BIGINT,
    person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT documents_has_target CHECK (person_id IS NOT NULL OR property_id IS NOT NULL)
);

CREATE INDEX documents_person_id_idx ON documents (person_id);
CREATE INDEX documents_property_id_idx ON documents (property_id);
CREATE INDEX documents_uploaded_by_idx ON documents (uploaded_by);
CREATE INDEX documents_category_idx ON documents (category);
CREATE INDEX documents_updated_at_idx ON documents (updated_at DESC);
CREATE INDEX documents_tags_gin_idx ON documents USING GIN (tags);
