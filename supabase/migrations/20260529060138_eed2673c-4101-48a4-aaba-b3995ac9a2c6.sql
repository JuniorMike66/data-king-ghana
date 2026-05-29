
-- 1. Site settings extensions
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS store_activation_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS store_activation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subagent_activation_base_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subagent_activation_enabled boolean NOT NULL DEFAULT false;

-- 2. Profile activation timestamps
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS subagent_activated_at timestamptz;

-- 3. Activation payments log
CREATE TABLE IF NOT EXISTS public.activation_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('store','subagent')),
  amount numeric NOT NULL,
  sponsor_markup numeric NOT NULL DEFAULT 0,
  sponsor_id uuid,
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.activation_payments TO authenticated;
GRANT ALL ON public.activation_payments TO service_role;

ALTER TABLE public.activation_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY ap_select_own ON public.activation_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY ap_insert_own ON public.activation_payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY ap_admin_all ON public.activation_payments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER touch_activation_payments
  BEFORE UPDATE ON public.activation_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Subagent activation markup (per sponsor)
CREATE TABLE IF NOT EXISTS public.subagent_activation_markup (
  sponsor_id uuid PRIMARY KEY,
  markup numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subagent_activation_markup TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subagent_activation_markup TO authenticated;
GRANT ALL ON public.subagent_activation_markup TO service_role;

ALTER TABLE public.subagent_activation_markup ENABLE ROW LEVEL SECURITY;

CREATE POLICY sam_public_read ON public.subagent_activation_markup
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY sam_sponsor_write ON public.subagent_activation_markup
  FOR ALL TO authenticated
  USING (sponsor_id = auth.uid())
  WITH CHECK (sponsor_id = auth.uid());
CREATE POLICY sam_admin_all ON public.subagent_activation_markup
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER touch_subagent_activation_markup
  BEFORE UPDATE ON public.subagent_activation_markup
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Sponsor earnings from subagent sales (extra profit for the agent)
CREATE OR REPLACE FUNCTION public.sponsor_profit_total(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- For each completed store_order data_purchase whose store is sponsored by _user_id,
  -- the sponsor earns (stored cost - admin agent_price). Stored cost is the subagent_price.
  SELECT COALESCE(SUM(
    GREATEST(public.store_tx_cost(t.id) - COALESCE(dp.agent_price, dp.price, 0), 0)
  ), 0)
  FROM public.transactions t
  JOIN public.stores s
    ON s.id = NULLIF(t.metadata->>'store_id','')::uuid
   AND s.sponsor_id = _user_id
  LEFT JOIN public.data_packages dp ON dp.id = t.package_id
  WHERE t.type = 'data_purchase'
    AND t.status = 'completed'
    AND t.metadata->>'source' = 'store_order';
$$;

-- 6. Sponsor markup earnings from subagent activations
CREATE OR REPLACE FUNCTION public.sponsor_activation_earnings(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(sponsor_markup), 0)
  FROM public.activation_payments
  WHERE sponsor_id = _user_id
    AND kind = 'subagent'
    AND status = 'completed';
$$;

-- 7. Extend the profit aggregate to include sponsor earnings
CREATE OR REPLACE FUNCTION public.store_profit_total(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- agent's own store sales
    COALESCE((
      SELECT SUM(t.amount - public.store_tx_cost(t.id))
      FROM public.transactions t
      WHERE t.user_id = _user_id
        AND t.type = 'data_purchase'
        AND t.status = 'completed'
        AND t.metadata->>'source' = 'store_order'
    ), 0)
    + public.sponsor_profit_total(_user_id)
    + public.sponsor_activation_earnings(_user_id);
$$;

-- store_profit_available already calls store_profit_total, so it picks this up automatically.

-- 8. Slug enforcement trigger: subagent store slugs must be prefixed with sponsor's slug.
CREATE OR REPLACE FUNCTION public.enforce_subagent_slug_prefix()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sponsor_slug text;
BEGIN
  IF NEW.sponsor_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT slug INTO _sponsor_slug FROM public.stores WHERE user_id = NEW.sponsor_id LIMIT 1;
  IF _sponsor_slug IS NULL THEN
    RAISE EXCEPTION 'Your sponsor has not created their store yet — ask them to set one up first.';
  END IF;
  IF NEW.slug !~ ('^' || regexp_replace(_sponsor_slug,'([\.\^\$\|\(\)\?\*\+\\\[\]\{\}])','\\\1','g') || '-[a-z0-9-]+$') THEN
    RAISE EXCEPTION 'Subagent store slug must start with "%-"', _sponsor_slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_subagent_slug_prefix_trg ON public.stores;
CREATE TRIGGER enforce_subagent_slug_prefix_trg
  BEFORE INSERT OR UPDATE OF slug, sponsor_id ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subagent_slug_prefix();

-- 9. Mark activation completed (used by verify endpoint)
CREATE OR REPLACE FUNCTION public.mark_activation_completed(_reference text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE ap RECORD;
BEGIN
  SELECT * INTO ap FROM public.activation_payments WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Activation payment not found'; END IF;
  IF ap.status = 'completed' THEN RETURN; END IF;

  UPDATE public.activation_payments SET status = 'completed', updated_at = now() WHERE id = ap.id;

  IF ap.kind = 'store' THEN
    UPDATE public.profiles SET store_activated_at = COALESCE(store_activated_at, now()) WHERE id = ap.user_id;
  ELSIF ap.kind = 'subagent' THEN
    UPDATE public.profiles SET subagent_activated_at = COALESCE(subagent_activated_at, now()) WHERE id = ap.user_id;
  END IF;
END;
$$;
