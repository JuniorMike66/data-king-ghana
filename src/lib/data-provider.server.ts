// Server-only helper that dispatches a data purchase to the Spendless Data API.
// Only called after Paystack payment has been verified (wallet or store order).
// Marks the transaction completed on success, refunds the wallet on failure.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type DispatchInput = {
  transactionId: string;
  userId: string;
  network: string;
  phone: string;
  sizeMb: number;
  amount: number;
};

const NETWORK_KEY: Record<string, string> = {
  mtn: "YELLO",
  airteltigo_ishare: "AT_PREMIUM",
  airteltigo_bigtime: "AT_BIGTIME",
  telecel: "TELECEL",
};

async function refund(userId: string, amount: number) {
  const { data: w } = await supabaseAdmin
    .from("wallets").select("balance").eq("user_id", userId).maybeSingle();
  if (w) {
    await supabaseAdmin
      .from("wallets")
      .update({ balance: Number(w.balance) + Number(amount) })
      .eq("user_id", userId);
  }
}

export async function dispatchDataPurchase(input: DispatchInput) {
  const apiKey = process.env.SPENDLESS_API_KEY;
  if (!apiKey) {
    await supabaseAdmin
      .from("transactions")
      .update({ metadata: { provider_error: "SPENDLESS_API_KEY not configured" } })
      .eq("id", input.transactionId);
    return;
  }

  // Idempotency: never dispatch the same transaction twice. If the row is
  // already completed/failed, or it already has a provider reference attached,
  // bail out — Paystack webhook + client verify can both fire for the same tx.
  const { data: current } = await supabaseAdmin
    .from("transactions")
    .select("status,metadata")
    .eq("id", input.transactionId)
    .maybeSingle();
  if (!current) return;
  if (current.status === "completed" || current.status === "failed" || current.status === "refunded") return;
  const meta: any = current.metadata ?? {};
  if (meta.provider === "spendless" && (meta.provider_reference || meta.dispatched_at)) return;

  // Mark as dispatched immediately so a concurrent call sees the lock.
  await supabaseAdmin
    .from("transactions")
    .update({ metadata: { ...meta, provider: "spendless", dispatched_at: new Date().toISOString() } })
    .eq("id", input.transactionId);

  const networkKey = NETWORK_KEY[input.network];
  if (!networkKey) {
    await supabaseAdmin
      .from("transactions")
      .update({ status: "failed", metadata: { ...meta, provider_error: `Unknown network: ${input.network}` } })
      .eq("id", input.transactionId);
    await refund(input.userId, input.amount);
    return;
  }

  const capacityGb = Math.round((input.sizeMb / 1024) * 100) / 100;

  try {
    const res = await fetch("https://spendless.top/api/purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        networkKey,
        recipient: input.phone,
        capacity: capacityGb,
      }),
    });

    const body: any = await res.json().catch(() => ({}));
    const providerStatus = String(body?.data?.status ?? body?.status ?? "").toLowerCase();
    const success = res.ok && providerStatus !== "failed" && body?.status !== "error";

    if (success) {
      await supabaseAdmin
        .from("transactions")
        .update({
          status: providerStatus === "completed" ? "completed" : "pending",
          metadata: {
            provider: "spendless",
            provider_reference: body?.data?.reference ?? body?.data?.orderId ?? null,
            provider_response: body,
          },
        })
        .eq("id", input.transactionId);
    } else {
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "failed",
          metadata: { provider: "spendless", http: res.status, provider_response: body },
        })
        .eq("id", input.transactionId);
      await refund(input.userId, input.amount);
    }
  } catch (e: any) {
    await supabaseAdmin
      .from("transactions")
      .update({ metadata: { provider: "spendless", provider_error: String(e?.message ?? e) } })
      .eq("id", input.transactionId);
  }
}
