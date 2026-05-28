CREATE TABLE public.subagents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subagents TO authenticated;
GRANT ALL ON public.subagents TO service_role;

ALTER TABLE public.subagents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subagents_owner_all"
ON public.subagents
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = subagents.store_id AND s.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = subagents.store_id AND s.user_id = auth.uid()));

CREATE POLICY "subagents_admin_all"
ON public.subagents
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER subagents_touch_updated_at
BEFORE UPDATE ON public.subagents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();