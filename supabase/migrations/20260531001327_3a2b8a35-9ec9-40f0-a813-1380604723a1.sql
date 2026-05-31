
-- Free data campaigns
CREATE TABLE public.free_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  network network_type NOT NULL,
  data_mb integer NOT NULL CHECK (data_mb > 0),
  total_tokens integer NOT NULL CHECK (total_tokens > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','completed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_campaigns TO authenticated;
GRANT ALL ON public.free_campaigns TO service_role;
ALTER TABLE public.free_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY fc_admin_all ON public.free_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY fc_auth_read ON public.free_campaigns FOR SELECT TO authenticated USING (true);

CREATE TABLE public.free_campaign_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.free_campaigns(id) ON DELETE CASCADE,
  code text NOT NULL,
  claimed_at timestamptz,
  claimed_phone text,
  claimed_by_user_id uuid,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX free_campaign_tokens_code_uniq ON public.free_campaign_tokens(code);
CREATE UNIQUE INDEX free_campaign_tokens_phone_per_campaign
  ON public.free_campaign_tokens(campaign_id, claimed_phone)
  WHERE claimed_phone IS NOT NULL;
CREATE INDEX free_campaign_tokens_campaign ON public.free_campaign_tokens(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_campaign_tokens TO authenticated;
GRANT ALL ON public.free_campaign_tokens TO service_role;
ALTER TABLE public.free_campaign_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY fct_admin_all ON public.free_campaign_tokens FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER touch_free_campaigns BEFORE UPDATE ON public.free_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomic claim: pick an unclaimed token by code for an active campaign,
-- enforce one-phone-per-campaign, and return campaign details for dispatch.
CREATE OR REPLACE FUNCTION public.claim_free_token(_user_id uuid, _code text, _phone text)
RETURNS TABLE(token_id uuid, campaign_id uuid, network network_type, data_mb integer, transaction_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok RECORD; camp RECORD; tx_id uuid;
BEGIN
  SELECT t.* INTO tok FROM public.free_campaign_tokens t
    WHERE upper(t.code) = upper(_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid token'; END IF;
  IF tok.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Token already used'; END IF;

  SELECT * INTO camp FROM public.free_campaigns WHERE id = tok.campaign_id;
  IF camp.status <> 'active' THEN RAISE EXCEPTION 'Campaign is not active'; END IF;

  IF EXISTS (SELECT 1 FROM public.free_campaign_tokens
              WHERE campaign_id = camp.id AND claimed_phone = _phone) THEN
    RAISE EXCEPTION 'This phone number has already claimed a token in this campaign';
  END IF;

  INSERT INTO public.transactions (user_id, type, status, amount, network, recipient_phone, description, metadata)
  VALUES (_user_id, 'data_purchase', 'pending', 0, camp.network, _phone,
          'Free campaign: ' || camp.name,
          jsonb_build_object('source','free_campaign','campaign_id',camp.id,'token_id',tok.id,'data_mb',camp.data_mb))
  RETURNING id INTO tx_id;

  UPDATE public.free_campaign_tokens
     SET claimed_at = now(), claimed_phone = _phone, claimed_by_user_id = _user_id, transaction_id = tx_id
   WHERE id = tok.id;

  -- Mark campaign completed if all tokens used
  IF (SELECT count(*) FROM public.free_campaign_tokens WHERE campaign_id = camp.id AND claimed_at IS NULL) = 0 THEN
    UPDATE public.free_campaigns SET status = 'completed' WHERE id = camp.id AND status = 'active';
  END IF;

  RETURN QUERY SELECT tok.id, camp.id, camp.network, camp.data_mb, tx_id;
END;
$$;
