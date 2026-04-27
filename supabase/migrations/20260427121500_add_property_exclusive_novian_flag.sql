ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS is_exclusive_novian BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.properties.is_exclusive_novian IS 'Marks whether the property is an exclusive Novian listing.';
