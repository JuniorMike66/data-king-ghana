
-- Add profit-withdrawal support fields
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS momo_network text,
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'profit';

-- Compute the cost basis of a store-order data transaction
CREATE OR REPLACE FUNCTION public.store_tx_cost(_tx_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF(t.metadata->>'cost','')::numeric,
    (SELECT sp.price FROM public.subagent_prices sp
       JOIN public.stores s ON s.id = NULLIF(t.metadata->>'store_id','')::uuid
      WHERE sp.sponsor_id = s.sponsor_id AND sp.package_id = t.package_id
      LIMIT 1),
    (SELECT agent_price FROM public.data_packages WHERE id = t.package_id),
    (SELECT price FROM public.data_packages WHERE id = t.package_id),
    t.amount
  )
  FROM public.transactions t WHERE t.id = _tx_id;
$$;

-- Total lifetime profit for a store owner (across all their store orders)
CREATE OR REPLACE FUNCTION public.store_profit_total(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(t.amount - public.store_tx_cost(t.id)), 0)
    FROM public.transactions t
   WHERE t.user_id = _user_id
     AND t.type = 'data_purchase'
     AND t.status = 'completed'
     AND t.metadata->>'source' = 'store_order';
$$;

-- Profit currently available for withdrawal (lifetime profit minus all non-rejected withdrawals)
CREATE OR REPLACE FUNCTION public.store_profit_available(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(
    public.store_profit_total(_user_id)
    - COALESCE((
        SELECT SUM(amount) FROM public.withdrawals
         WHERE user_id = _user_id
           AND source = 'profit'
           AND status IN ('pending','approved','paid')
      ), 0)
  , 0);
$$;

-- Submit a profit withdrawal request (24h hold, min GH50)
CREATE OR REPLACE FUNCTION public.request_store_withdrawal(
  _user_id uuid, _amount numeric,
  _momo_network text, _momo_number text, _momo_name text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w_id uuid; avail numeric;
BEGIN
  IF _amount IS NULL OR _amount < 50 THEN
    RAISE EXCEPTION 'Minimum withdrawal is GH50';
  END IF;
  avail := public.store_profit_available(_user_id);
  IF avail < 50 THEN
    RAISE EXCEPTION 'You need at least GH50 in profit before requesting a withdrawal';
  END IF;
  IF _amount > avail THEN
    RAISE EXCEPTION 'Amount exceeds available profit (GH%)', avail;
  END IF;
  INSERT INTO public.withdrawals(
    user_id, amount, bank_name, account_number, account_name,
    momo_network, available_at, status, source
  ) VALUES (
    _user_id, _amount, _momo_network, _momo_number, _momo_name,
    _momo_network, now() + interval '24 hours', 'pending', 'profit'
  ) RETURNING id INTO w_id;
  RETURN w_id;
END $$;

GRANT EXECUTE ON FUNCTION public.store_tx_cost(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_profit_total(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_profit_available(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_store_withdrawal(uuid, numeric, text, text, text) TO authenticated;
