alter table if exists public.agents
  add column if not exists whatsapp_display_name text,
  add column if not exists whatsapp_phone text,
  add column if not exists whatsapp_profile_picture_url text;
