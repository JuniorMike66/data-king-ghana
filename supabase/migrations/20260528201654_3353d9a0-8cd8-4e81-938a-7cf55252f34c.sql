
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS sponsor_id uuid;
CREATE INDEX IF NOT EXISTS idx_stores_sponsor ON public.stores(sponsor_id);

-- Backfill from profiles
UPDATE public.stores s
SET sponsor_id = p.sponsor_id
FROM public.profiles p
WHERE p.id = s.user_id AND s.sponsor_id IS NULL;

-- Keep in sync
CREATE OR REPLACE FUNCTION public.set_store_sponsor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT sponsor_id INTO NEW.sponsor_id FROM public.profiles WHERE id = NEW.user_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stores_sponsor ON public.stores;
CREATE TRIGGER trg_stores_sponsor
BEFORE INSERT OR UPDATE OF user_id ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.set_store_sponsor();
