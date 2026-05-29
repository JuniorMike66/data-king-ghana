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

  SELECT sponsor_id, store_activated_at INTO _sponsor, _activated
    FROM public.profiles WHERE id = _user_id;

  IF _sponsor IS NOT NULL THEN
    -- subagents pay their sponsor's subagent price
    SELECT price INTO _price FROM public.subagent_prices
      WHERE sponsor_id = _sponsor AND package_id = _package_id;
    IF _price IS NULL THEN
      _price := COALESCE(pkg.agent_price, pkg.price);
    END IF;
  ELSIF _activated IS NOT NULL THEN
    -- activated store owners get admin agent prices
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