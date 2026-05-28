
-- 1) Add sponsor_id to profiles (the user who recruited this account as an agent/subagent)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sponsor_id uuid;
CREATE INDEX IF NOT EXISTS idx_profiles_sponsor ON public.profiles(sponsor_id);

-- Allow sponsors to read their subagent profiles
DROP POLICY IF EXISTS profiles_select_sponsor ON public.profiles;
CREATE POLICY profiles_select_sponsor ON public.profiles
  FOR SELECT TO authenticated
  USING (sponsor_id = auth.uid());

DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Subagent pricing table (sponsor sets per-package prices for subagents)
CREATE TABLE IF NOT EXISTS public.subagent_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL,
  package_id uuid NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sponsor_id, package_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subagent_prices TO authenticated;
GRANT SELECT ON public.subagent_prices TO anon;
GRANT ALL ON public.subagent_prices TO service_role;

ALTER TABLE public.subagent_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY subagent_prices_sponsor_all ON public.subagent_prices
  FOR ALL TO authenticated
  USING (sponsor_id = auth.uid())
  WITH CHECK (sponsor_id = auth.uid());

-- Subagents can read their sponsor's prices
CREATE POLICY subagent_prices_subagent_read ON public.subagent_prices
  FOR SELECT TO authenticated
  USING (sponsor_id = (SELECT sponsor_id FROM public.profiles WHERE id = auth.uid()));

-- Public reads for storefront pricing of subagent stores
CREATE POLICY subagent_prices_public_read ON public.subagent_prices
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY subagent_prices_admin_all ON public.subagent_prices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Update handle_new_user to capture sponsor_id from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sponsor uuid;
BEGIN
  BEGIN
    _sponsor := NULLIF(NEW.raw_user_meta_data->>'sponsor_id','')::uuid;
  EXCEPTION WHEN others THEN _sponsor := NULL; END;

  INSERT INTO public.profiles (id, email, full_name, phone, sponsor_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone', _sponsor);
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;

-- 4) Update purchase_data to use sponsor-set price if available
CREATE OR REPLACE FUNCTION public.purchase_data(_user_id uuid, _package_id uuid, _phone text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pkg RECORD;
  bal numeric;
  tx_id uuid;
  _sponsor uuid;
  _price numeric;
BEGIN
  SELECT * INTO pkg FROM public.data_packages WHERE id = _package_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not available'; END IF;

  SELECT sponsor_id INTO _sponsor FROM public.profiles WHERE id = _user_id;
  _price := pkg.price;
  IF _sponsor IS NOT NULL THEN
    SELECT price INTO _price FROM public.subagent_prices
      WHERE sponsor_id = _sponsor AND package_id = _package_id;
    IF _price IS NULL THEN
      _price := COALESCE(pkg.agent_price, pkg.price);
    END IF;
  END IF;

  SELECT balance INTO bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF bal < _price THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  UPDATE public.wallets SET balance = balance - _price, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO public.transactions (user_id, type, status, amount, network, package_id, recipient_phone, description)
  VALUES (_user_id, 'data_purchase', 'pending', _price, pkg.network, pkg.id, _phone,
          pkg.size_label || ' for ' || _phone)
  RETURNING id INTO tx_id;

  RETURN tx_id;
END;
$function$;
