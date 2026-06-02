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

  IF EXISTS (SELECT 1 FROM public.free_campaign_tokens fct
              WHERE fct.campaign_id = camp.id AND fct.claimed_phone = _phone) THEN
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

  IF (SELECT count(*) FROM public.free_campaign_tokens fct WHERE fct.campaign_id = camp.id AND fct.claimed_at IS NULL) = 0 THEN
    UPDATE public.free_campaigns SET status = 'completed' WHERE id = camp.id AND status = 'active';
  END IF;

  RETURN QUERY SELECT tok.id, camp.id, camp.network, camp.data_mb, tx_id;
END;
$function$;