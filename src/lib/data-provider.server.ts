// Server-only helper that dispatches a data purchase to an upstream provider.
// If DATA_PROVIDER_URL is not configured, the transaction stays "pending" for
// admins to fulfill manually. When configured, the provider's JSON response
// determines whether the tx is marked completed or failed (and refunded).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type DispatchInput = {
  transactionId: string;
  userId: string;
  network: string;
  phone: string;
  sizeMb: number;
  amount: number;
};

export async function dispatchDataPurchase(input: DispatchInput) {
  const url = process.env.DATA_PROVIDER_URL;
  const apiKey = process.env.DATA_PROVIDER_API_KEY;
  if (!url) return; // leave pending for manual fulfillment

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        reference: input.transactionId,
        network: input.network,
        phone: input.phone,
        size_mb: input.sizeMb,
        amount: input.amount,
      }),
    });
    const ok = res.ok;
    const body = await res.json().catch(() => ({}));

    if (ok && body?.status !== "failed") {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "completed", metadata: { provider: body } })
        .eq("id", input.transactionId);
    } else {
      // refund wallet
      const { data: w } = await supabaseAdmin
        .from("wallets").select("balance").eq("user_id", input.userId).maybeSingle();
      if (w) {
        await supabaseAdmin
          .from("wallets")
          .update({ balance: Number(w.balance) + Number(input.amount) })
          .eq("user_id", input.userId);
      }
      await supabaseAdmin
        .from("transactions")
        .update({ status: "failed", metadata: { provider: body, http: res.status } })
        .eq("id", input.transactionId);
    }
  } catch (e: any) {
    await supabaseAdmin
      .from("transactions")
      .update({ metadata: { provider_error: String(e?.message ?? e) } })
      .eq("id", input.transactionId);
  }
}
