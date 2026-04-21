-- Initial Schema for Novian AI-First Real Estate CRM

-- 1. TENANTS (Agencies / Branches)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (Humans and AI Agents)
CREATE TYPE user_type AS ENUM ('human', 'ai_agent');
CREATE TYPE user_role AS ENUM ('ceo', 'coo', 'creo', 'director', 'manager', 'specialist', 'broker');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Maps to auth.users if human
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    type user_type NOT NULL,
    role user_role NOT NULL,
    manager_id UUID REFERENCES users(id), -- For the reporting structure
    avatar_url TEXT,
    system_prompt TEXT, -- For AI Agents: Their specific instructions/persona
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. THE "WAR ROOM" (Centralized AI Chat & Collaboration)
CREATE TABLE chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., 'General', 'Lead #123 Strategy', 'Operations'
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB, -- For system logs, tool calls (e.g., {"action": "searched_properties", "results": 5})
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LEADS & CRM
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualifying', 'qualified', 'visiting', 'negotiating', 'closed_won', 'closed_lost');

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    assigned_human_id UUID REFERENCES users(id), -- If it needs a human touch
    assigned_ai_id UUID REFERENCES users(id), -- Which AI is currently handling them
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    status lead_status DEFAULT 'new',
    budget_min NUMERIC,
    budget_max NUMERIC,
    preferences JSONB, -- Dynamic fields (neighborhoods, bedrooms, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROPERTIES
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    location JSONB, -- Address, lat, lng
    attributes JSONB, -- Bedrooms, bathrooms, area_m2
    images TEXT[], -- Array of URLs
    source TEXT, -- e.g., 'internal', 'zap', 'olx' (via firecrawl)
    status TEXT DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. EXTERNAL COMMUNICATIONS (WhatsApp/Email Logs)
CREATE TABLE external_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES users(id), -- Which AI or Human sent it
    platform TEXT NOT NULL, -- 'whatsapp' (Evolution API) or 'email' (Brevo)
    direction TEXT NOT NULL, -- 'inbound' or 'outbound'
    content TEXT NOT NULL,
    external_message_id TEXT, -- ID from WhatsApp or Brevo
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AI AGENT TASK QUEUE / HEARTBEAT
-- Used by the Cron Job to wake up agents for time-based triggers
CREATE TABLE agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL, -- e.g., 'follow_up_cold_leads', 'scrape_new_listings'
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    payload JSONB,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add simple RLS policies (To be expanded)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;