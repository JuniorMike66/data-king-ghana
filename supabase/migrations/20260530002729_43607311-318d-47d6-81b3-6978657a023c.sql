
-- 1. New status value for the moment between "user started paying" and "paystack confirmed"
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'pending_payment' BEFORE 'pending';

-- 2. Idempotency column on transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS gateway_event_id text;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_gateway_event_id_uniq
  ON public.transactions(gateway_event_id) WHERE gateway_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_reference_idx
  ON public.transactions(reference) WHERE reference IS NOT NULL;

-- 3. Helper: mark a wallet-topup transaction as completed and credit wallet in one go.
CREATE OR REPLACE FUNCTION public.complete_wallet_topup(
  _reference text,
  _gateway_event_id text,
  _channel text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tx RECORD;
BEGIN
  SELECT * INTO tx FROM public.transactions WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found for reference %', _reference; END IF;
  IF tx.status = 'completed' THEN RETURN; END IF;
  IF tx.type <> 'wallet_topup' THEN RAISE EXCEPTION 'reference is not a wallet topup'; END IF;

  UPDATE public.wallets SET balance = balance + tx.amount, updated_at = now() WHERE user_id = tx.user_id;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (tx.user_id, tx.amount);
  END IF;

  UPDATE public.transactions
     SET status = 'completed',
         gateway_event_id = COALESCE(gateway_event_id, _gateway_event_id),
         description = 'Wallet top-up via Paystack (' || COALESCE(_channel, 'online') || ')',
         updated_at = now()
   WHERE id = tx.id;
END;
$$;

-- 4. Helper: mark a paid store_order transaction as 'pending' (paid, awaiting provider)
CREATE OR REPLACE FUNCTION public.mark_store_order_paid(
  _reference text,
  _gateway_event_id text,
  _channel text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tx RECORD;
BEGIN
  SELECT * INTO tx FROM public.transactions WHERE reference = _reference FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction not found for reference %', _reference; END IF;
  IF tx.status NOT IN ('pending_payment','failed') THEN RETURN tx.id; END IF;

  UPDATE public.transactions
     SET status = 'pending',
         gateway_event_id = COALESCE(gateway_event_id, _gateway_event_id),
         metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('paystack_channel', _channel, 'paid_at', now()),
         updated_at = now()
   WHERE id = tx.id;
  RETURN tx.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_wallet_topup(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_store_order_paid(text,text,text) TO service_role;
