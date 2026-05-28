CREATE OR REPLACE FUNCTION public.purchase_checker(_user_id uuid, _checker_id uuid, _phone text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  chk RECORD; bal numeric; tx_id uuid;
BEGIN
  SELECT * INTO chk FROM public.result_checkers WHERE id = _checker_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checker not available'; END IF;

  SELECT balance INTO bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF bal < chk.price THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  UPDATE public.wallets SET balance = balance - chk.price, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO public.transactions (user_id, type, status, amount, description, recipient_phone)
  VALUES (_user_id, 'checker_purchase', 'pending', chk.price, chk.name || ' result checker', _phone)
  RETURNING id INTO tx_id;

  RETURN tx_id;
END;
$function$;