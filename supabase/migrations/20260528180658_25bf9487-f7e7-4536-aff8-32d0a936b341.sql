
-- Withdrawals table
CREATE TYPE public.withdrawal_status AS ENUM ('pending','approved','paid','rejected');

CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status withdrawal_status NOT NULL DEFAULT 'pending',
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "withdrawals_admin_all" ON public.withdrawals FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_withdrawals_touch BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- API keys policies
CREATE POLICY "api_keys_insert_own" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "api_keys_update_own" ON public.api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "api_keys_delete_own" ON public.api_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "api_keys_admin_all" ON public.api_keys FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Wallet credit (called by server fn after Paystack verification)
CREATE OR REPLACE FUNCTION public.credit_wallet(_user_id uuid, _amount numeric, _reference text, _description text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  -- idempotency on reference
  IF EXISTS (SELECT 1 FROM public.transactions WHERE reference = _reference AND type = 'wallet_topup' AND status = 'completed') THEN
    RETURN;
  END IF;

  UPDATE public.wallets SET balance = balance + _amount, updated_at = now() WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_user_id, _amount);
  END IF;

  INSERT INTO public.transactions (user_id, type, status, amount, reference, description)
  VALUES (_user_id, 'wallet_topup', 'completed', _amount, _reference, _description);
END;
$$;

-- Atomic data purchase (debit + insert pending order)
CREATE OR REPLACE FUNCTION public.purchase_data(_user_id uuid, _package_id uuid, _phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pkg RECORD;
  bal numeric;
  tx_id uuid;
BEGIN
  SELECT * INTO pkg FROM public.data_packages WHERE id = _package_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not available'; END IF;

  SELECT balance INTO bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF bal < pkg.price THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  UPDATE public.wallets SET balance = balance - pkg.price, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO public.transactions (user_id, type, status, amount, network, package_id, recipient_phone, description)
  VALUES (_user_id, 'data_purchase', 'pending', pkg.price, pkg.network, pkg.id, _phone,
          pkg.size_label || ' for ' || _phone)
  RETURNING id INTO tx_id;

  RETURN tx_id;
END;
$$;

-- Atomic checker purchase
CREATE OR REPLACE FUNCTION public.purchase_checker(_user_id uuid, _checker_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chk RECORD; bal numeric; tx_id uuid;
BEGIN
  SELECT * INTO chk FROM public.result_checkers WHERE id = _checker_id AND active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checker not available'; END IF;

  SELECT balance INTO bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF bal < chk.price THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  UPDATE public.wallets SET balance = balance - chk.price, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO public.transactions (user_id, type, status, amount, description)
  VALUES (_user_id, 'checker_purchase', 'pending', chk.price, chk.name || ' result checker')
  RETURNING id INTO tx_id;

  RETURN tx_id;
END;
$$;

-- Withdrawal request (debits wallet immediately, creates pending withdrawal)
CREATE OR REPLACE FUNCTION public.request_withdrawal(_user_id uuid, _amount numeric, _bank text, _account text, _name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal numeric; w_id uuid;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT balance INTO bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.wallets SET balance = balance - _amount, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.withdrawals (user_id, amount, bank_name, account_number, account_name)
  VALUES (_user_id, _amount, _bank, _account, _name) RETURNING id INTO w_id;
  INSERT INTO public.transactions (user_id, type, status, amount, description)
  VALUES (_user_id, 'withdrawal', 'pending', _amount, 'Withdrawal to ' || _bank || ' • ' || _account);
  RETURN w_id;
END;
$$;
