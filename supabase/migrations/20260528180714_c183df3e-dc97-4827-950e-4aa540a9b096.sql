
REVOKE ALL ON FUNCTION public.credit_wallet(uuid,numeric,text,text) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.purchase_data(uuid,uuid,text) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.purchase_checker(uuid,uuid) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.request_withdrawal(uuid,numeric,text,text,text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid,numeric,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_data(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_checker(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid,numeric,text,text,text) TO service_role;
