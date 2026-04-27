ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS creci TEXT;

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS broker_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;

ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS broker_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS properties_broker_user_id_idx
    ON public.properties (broker_user_id);

CREATE INDEX IF NOT EXISTS people_broker_user_id_idx
    ON public.people (broker_user_id);

COMMENT ON COLUMN public.app_users.creci IS 'Broker CRECI registration number for internal users.';
COMMENT ON COLUMN public.properties.broker_user_id IS 'Assigned internal broker responsible for the property.';
COMMENT ON COLUMN public.people.broker_user_id IS 'Assigned internal broker responsible for the person/contact.';
