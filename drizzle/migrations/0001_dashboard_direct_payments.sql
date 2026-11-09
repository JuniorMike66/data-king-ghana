CREATE OR REPLACE FUNCTION public.start_dashboard_payment(_user_id uuid,_package_id uuid,_phone text,_email text,_reference text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.data_packages%ROWTYPE; pr public.profiles%ROWTYPE; price numeric; gross numeric; tid uuid;
BEGIN
 IF _phone !~ '^0[0-9]{9}$' THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
 SELECT * INTO pr FROM public.profiles WHERE id=_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.site_settings WHERE id=1 AND maintenance_mode) AND NOT public.has_role(_user_id,'admin') THEN RAISE EXCEPTION 'The site is undergoing maintenance'; END IF;
 IF pr.sponsor_id IS NOT NULL AND pr.subagent_activated_at IS NULL AND EXISTS(SELECT 1 FROM public.site_settings WHERE id=1 AND subagent_activation_enabled) AND NOT public.has_role(_user_id,'admin') THEN RAISE EXCEPTION 'Activate your account first'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_phone,0));
 IF EXISTS(SELECT 1 FROM public.transactions WHERE recipient_phone=_phone AND type='data_purchase' AND status NOT IN ('failed','refunded') AND created_at>now()-interval '7 minutes') THEN RAISE EXCEPTION 'Please wait 7 minutes before ordering again for this number'; END IF;
 SELECT * INTO p FROM public.data_packages WHERE id=_package_id AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Package not available'; END IF;
 price:=p.price;
 IF pr.sponsor_id IS NOT NULL THEN
 SELECT sp.price INTO price FROM public.subagent_prices sp WHERE sp.sponsor_id=pr.sponsor_id AND sp.package_id=p.id;
 price:=coalesce(price,p.agent_price,p.price);
 ELSIF pr.store_activated_at IS NOT NULL THEN price:=coalesce(p.agent_price,p.price); END IF;
 IF price<=0 THEN RAISE EXCEPTION 'Package not available'; END IF;
 gross:=ceil(price/0.97*100)/100;
 INSERT INTO public.transactions(user_id,type,status,amount,network,package_id,recipient_phone,reference,description,metadata)
 VALUES(_user_id,'data_purchase','pending_payment',price,p.network,p.id,_phone,_reference,p.size_label||' direct Paystack order',jsonb_build_object('source','dashboard_paystack','customer_email',_email,'gross',gross,'paystack_fee',gross-price,'payment_method','paystack')) RETURNING id INTO tid;
 RETURN tid;
END $$;
REVOKE ALL ON FUNCTION public.start_dashboard_payment(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_dashboard_payment(uuid,uuid,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.complete_guest_order(_reference text,_gateway_event_id text,_amount_pesewas bigint,_currency text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.transactions%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.transactions WHERE reference=_reference FOR UPDATE;
 IF NOT FOUND OR t.type<>'data_purchase' OR t.metadata->>'source' NOT IN ('guest_order','dashboard_paystack') THEN RAISE EXCEPTION 'Direct order not found'; END IF;
 IF _currency<>'GHS' OR _amount_pesewas IS DISTINCT FROM round((t.metadata->>'gross')::numeric*100)::bigint THEN RAISE EXCEPTION 'Payment amount or currency does not match'; END IF;
 IF t.metadata->>'paid_at' IS NOT NULL THEN RETURN t.id; END IF;
 IF t.status NOT IN ('pending_payment','failed') THEN RAISE EXCEPTION 'Order cannot be paid'; END IF;
 UPDATE public.transactions SET status='pending',gateway_event_id=_gateway_event_id,metadata=t.metadata||jsonb_build_object('paid_at',now(),'no_refund_issued',true,'payment_method','paystack'),updated_at=now() WHERE id=t.id;
 RETURN t.id;
END $$;
CREATE OR REPLACE FUNCTION public.claim_guest_dispatch(_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.transactions SET metadata=metadata||jsonb_build_object('guest_dispatch_claimed_at',now()) WHERE id=_id AND metadata->>'source' IN ('guest_order','dashboard_paystack') AND metadata->>'paid_at' IS NOT NULL AND status='pending' AND metadata->>'guest_dispatch_claimed_at' IS NULL;
 RETURN FOUND;
END $$;