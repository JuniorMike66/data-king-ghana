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
  if (!amount || amount <= 0) return;
  const { data: w } = await supabaseAdmin
    .from("wallets").select("balance").eq("user_id", userId).maybeSingle();
  if (w) {
    await supabaseAdmin
      .from("wallets")
      .update({ balance: Number(w.balance) + Number(amount) })
      .eq("user_id", userId);
  }
}

// Detect provider "insufficient balance" / "wallet empty" style failures so we
// can keep the order pending (already paid by the customer) and let an admin
// retry it once the provider account has been topped up — without refunding
// the customer or charging them twice.
function isInsufficientBalanceError(body: any, httpStatus: number): boolean {
  try {
    const blob = JSON.stringify(body ?? {}).toLowerCase();
    if (
      blob.includes("insufficient balance") ||
      blob.includes("insufficient funds") ||
      blob.includes("wallet balance") ||
      blob.includes("low balance") ||
      blob.includes("balance is low") ||
      blob.includes("not enough balance")
    ) return true;
  } catch { /* ignore */ }
  // Some providers return 402 Payment Required for low balance.
  if (httpStatus === 402) return true;
  return false;
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
            ...meta,
            provider: "spendless",
            provider_reference: body?.data?.reference ?? body?.data?.orderId ?? null,
            provider_response: body,
            no_refund_issued: false,
          },
        })
        .eq("id", input.transactionId);
      return;
    }

    // === FAILURE PATH ===
    // If the provider rejected the order because THEIR wallet is empty, we
    // keep the order pending (customer sees "success") and flag it for the
    // admin to retry. No refund is issued, so the retry must NOT re-debit.
    if (isInsufficientBalanceError(body, res.status)) {
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "pending",
          metadata: {
            ...meta,
            provider: "spendless",
            http: res.status,
            provider_response: body,
            provider_error:
              body?.message ?? body?.error ?? "Provider wallet balance is too low",
            provider_insufficient_balance: true,
            no_refund_issued: true,
            // Clear dispatch lock so admin retry can re-call the provider.
            dispatched_at: null,
            flagged_suspicious: meta.flagged_suspicious ?? false,
          },
        })
        .eq("id", input.transactionId);
      return;
    }

    // Generic failure — refund the customer and mark failed as before.
    await supabaseAdmin
      .from("transactions")
      .update({
        status: "failed",
        metadata: {
          ...meta,
          provider: "spendless",
          http: res.status,
          provider_response: body,
          provider_error: body?.message ?? body?.error ?? "Provider rejected the order",
          no_refund_issued: false,
        },
      })
      .eq("id", input.transactionId);
    await refund(input.userId, input.amount);
  } catch (e: any) {
    await supabaseAdmin
      .from("transactions")
      .update({ metadata: { ...meta, provider: "spendless", provider_error: String(e?.message ?? e) } })
      .eq("id", input.transactionId);
  }
}
