
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
  _activated timestamptz;
  _price numeric;
BEGIN
  SELECT * INTO pkg FROM public.data_packages WHERE id = _package_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not available'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE recipient_phone = _phone
       AND type = 'data_purchase'
       AND status NOT IN ('failed','refunded','pending_payment')
       AND created_at > now() - interval '7 minutes'
  ) THEN
    RAISE EXCEPTION 'A data order to % was just placed. Please wait 7 minutes before sending another.', _phone;
  END IF;

  SELECT sponsor_id, store_activated_at INTO _sponsor, _activated
    FROM public.profiles WHERE id = _user_id;

  IF _sponsor IS NOT NULL THEN
    SELECT price INTO _price FROM public.subagent_prices
      WHERE sponsor_id = _sponsor AND package_id = _package_id;
    IF _price IS NULL THEN
      _price := COALESCE(pkg.agent_price, pkg.price);
    END IF;
  ELSIF _activated IS NOT NULL THEN
    _price := COALESCE(pkg.agent_price, pkg.price);
  ELSE
    _price := pkg.price;
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

CREATE OR REPLACE FUNCTION public.claim_free_token(_user_id uuid, _code text, _phone text)
 RETURNS TABLE(token_id uuid, campaign_id uuid, network network_type, data_mb integer, transaction_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF EXISTS (
    SELECT 1 FROM public.transactions
     WHERE recipient_phone = _phone
       AND type = 'data_purchase'
       AND status NOT IN ('failed','refunded','pending_payment')
       AND created_at > now() - interval '7 minutes'
  ) THEN
    RAISE EXCEPTION 'A data order to % was just placed. Please wait 7 minutes before claiming again.', _phone;
  END IF;

  INSERT INTO public.transactions (user_id, type, status, amount, network, recipient_phone, description, metadata)
  VALUES (_user_id, 'data_purchase', 'pending', 0, camp.network, _phone,
          'Free campaign: ' || camp.name,
          jsonb_build_object('source','free_campaign','campaign_id',camp.id,'token_id',tok.id,'data_mb',camp.data_mb))
  RETURNING id INTO tx_id;

  UPDATE public.free_campaign_tokens
     SET claimed_at = now(), claimed_phone = _phone, claimed_by_user_id = _user_id, transaction_id = tx_id
   WHERE id = tok.id;

  IF (SELECT count(*) FROM public.free_campaign_tokens WHERE campaign_id = camp.id AND claimed_at IS NULL) = 0 THEN
    UPDATE public.free_campaigns SET status = 'completed' WHERE id = camp.id AND status = 'active';
  END IF;

  RETURN QUERY SELECT tok.id, camp.id, camp.network, camp.data_mb, tx_id;
END;
$function$;
