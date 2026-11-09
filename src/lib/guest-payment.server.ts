import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchDataPurchase } from "@/lib/data-provider.server";
import { matchesGuestPayment } from "@/lib/guest-payment";

export async function finalizeGuestPayment(payment: { reference: string; id?: string | number; status?: string; amount?: number; currency?: string }) {
  const { data: order, error } = await supabaseAdmin.from("transactions")
    .select("id,metadata").eq("reference", payment.reference).maybeSingle();
  if (error || !order) throw new Error("Guest order not found");
  const metadata = order.metadata as Record<string, unknown> | null;
  if (!metadata || !["guest_order", "dashboard_paystack"].includes(String(metadata.source)) || !matchesGuestPayment(Number(metadata.gross), payment)) {
    throw new Error("Payment does not match this guest order");
  }
  const { error: paidError } = await supabaseAdmin.rpc("complete_guest_order", {
    _reference: payment.reference, _gateway_event_id: String(payment.id ?? payment.reference),
    _amount_pesewas: Number(payment.amount), _currency: payment.currency ?? "",
  });
  if (paidError) throw new Error(paidError.message);
  const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_guest_dispatch", { _id: order.id });
  if (claimError) throw new Error(claimError.message);
  if (claimed) await dispatchDataPurchase({ transactionId: order.id, userId: "", network: "", phone: "", sizeMb: 0, amount: 0 });
  return order.id;
}