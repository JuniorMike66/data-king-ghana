// Server-only helper that dispatches a data purchase to the SwiftData Ghana API.
// Only called after Paystack payment has been verified (wallet or store order).
// Marks the transaction completed on success, refunds the wallet on failure,
// keeps the order pending and flags it for admin retry if SwiftData reports
// an insufficient provider wallet balance.
//
// Docs: https://swiftdatagh.shop/api-docs
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type DispatchInput = {
  transactionId: string;
  userId: string;
  network: string;
  phone: string;
  sizeMb: number;
  amount: number;
  packageId?: string | null;
};

const SWIFT_BASE =
  "https://ihrvvniomtoofrjkmalb.supabase.co/functions/v1/api/v1";

// SwiftData uses network codes like YELLO (MTN), RED (AT), TELECEL.
// We retain this for reference / future endpoints that need it.
const NETWORK_KEY: Record<string, string> = {
  mtn: "yello",
  airteltigo_ishare: "at_ishare",
  airteltigo_bigtime: "at_bigtime",
  telecel: "telecel",
};

// Fallback mapping from our (network, size_mb) to SwiftData package_id when an
// admin hasn't set provider_package_id on the row yet. SwiftData package IDs
// follow patterns like "yellow_5gb", "red_6gb", "telecel_10gb".
function autoDeriveProviderPackageId(network: string, sizeMb: number): string | null {
  const prefix =
    network === "mtn" ? "yellow" :
    network === "telecel" ? "telecel" :
    network.startsWith("airteltigo") ? "red" : null;
  if (!prefix) return null;
  if (sizeMb % 1024 === 0) return `${prefix}_${sizeMb / 1024}gb`;
  return `${prefix}_${sizeMb}mb`;
}

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

// Detect provider "insufficient balance" failures so we can keep the order
// pending (customer already paid) and let an admin retry it once the provider
// account has been topped up — without refunding or double-charging.
function isInsufficientBalanceError(body: any, httpStatus: number): boolean {
  try {
    const blob = JSON.stringify(body ?? {}).toLowerCase();
    if (
      blob.includes("insufficient balance") ||
      blob.includes("insufficient funds") ||
      blob.includes("insufficient api wallet") ||
      blob.includes("api wallet") && blob.includes("balance") ||
      blob.includes("wallet balance") ||
      blob.includes("low balance") ||
      blob.includes("not enough balance") ||
      blob.includes("top up your")
    ) return true;
  } catch { /* ignore */ }
  if (httpStatus === 402) return true;
  return false;
}

export async function dispatchDataPurchase(input: DispatchInput) {
  const apiKey = process.env.SWIFT_RESELLER_API_KEY?.trim();
  if (!apiKey) {
    await supabaseAdmin
      .from("transactions")
      .update({ metadata: { provider_error: "SWIFT_RESELLER_API_KEY not configured" } })
      .eq("id", input.transactionId);
    return;
  }

  // Idempotency: never dispatch the same transaction twice.
  const { data: current } = await supabaseAdmin
    .from("transactions")
    .select("status,metadata,package_id,network,recipient_phone,amount,user_id")
    .eq("id", input.transactionId)
    .maybeSingle();
  if (!current) return;
  if (
    current.status === "completed" ||
    current.status === "failed" ||
    current.status === "refunded"
  ) return;
  const meta: any = current.metadata ?? {};
  // Respect every lock key callers have ever set.
  if (
    meta.provider === "swiftdata" &&
    (meta.provider_reference || meta.dispatched_at || meta.provider_dispatched_at)
  ) return;

  const network = (current.network as string) ?? input.network;
  const phone = (current.recipient_phone as string) ?? input.phone;
  const userId = (current.user_id as string) ?? input.userId;
  const amount = Number(current.amount ?? input.amount ?? 0);

  let sizeMb = input.sizeMb;
  if (current.package_id) {
    const { data: pkg } = await supabaseAdmin
      .from("data_packages").select("size_mb").eq("id", current.package_id).maybeSingle();
    if (pkg?.size_mb) sizeMb = Number(pkg.size_mb);
  }
  const providerNetwork = NETWORK_KEY[network];
  const sizeGb = Math.round((sizeMb / 1024) * 100) / 100;
  const providerPackageId = providerNetwork ? `${providerNetwork}_${sizeGb}gb` : null;
  if (!providerNetwork || !sizeGb) {
    await supabaseAdmin.from("transactions").update({
      status: "failed",
      metadata: { ...meta, provider: "swiftdata", provider_error: `Unsupported network/size: ${network} / ${sizeMb}MB` },
    }).eq("id", input.transactionId);
    await refund(userId, amount);
    return;
  }

  const dispatchedAt = new Date().toISOString();
  await supabaseAdmin.from("transactions").update({
    metadata: { ...meta, provider: "swiftdata", provider_package_id: providerPackageId,
      dispatched_at: dispatchedAt, provider_dispatched_at: dispatchedAt },
  }).eq("id", input.transactionId);

  // Unique per attempt so admin retries are not rejected as duplicate references.
  const retryN = Number(meta.retry_count ?? 0);
  const reference = retryN > 0 ? `${input.transactionId}-r${retryN}` : input.transactionId;
  const rawBody = JSON.stringify({ phone, network: providerNetwork, size_gb: sizeGb, reference });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  try {
    const res = await fetch(`${SWIFT_BASE}/buy-data`, {
      method: "POST",
      headers,
      body: rawBody,
    });

    const body: any = await res.json().catch(() => ({}));
    const providerStatus = String(body?.order?.status ?? body?.status ?? "").toLowerCase();
    // SwiftData lifecycle: pending → paid → processing → fulfilled / fulfillment_failed
    const failedStatuses = new Set(["fulfillment_failed", "failed", "cancelled", "canceled"]);
    const completedStatuses = new Set(["completed", "fulfilled"]);
    const success =
      res.ok &&
      body?.success !== false &&
      !failedStatuses.has(providerStatus);

    if (success) {
      await supabaseAdmin
        .from("transactions")
        .update({
          status: completedStatuses.has(providerStatus) ? "completed" : "pending",
          metadata: {
            ...meta,
            provider: "swiftdata",
            provider_package_id: providerPackageId,
            provider_reference: body?.order?.reference ?? body?.order_id ?? null,
            provider_status: providerStatus || null,
            provider_response: body,
            no_refund_issued: false,
          },
        })
        .eq("id", input.transactionId);
      return;
    }

    // === FAILURE PATH ===
    // Provider out of balance: keep order pending, do NOT refund, flag for admin retry.
    if (isInsufficientBalanceError(body, res.status)) {
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "pending",
          metadata: {
            ...meta,
            provider: "swiftdata",
            provider_package_id: providerPackageId,
            http: res.status,
            provider_response: body,
            provider_error:
              body?.message ?? body?.error ?? "Provider API wallet balance is too low",
            provider_insufficient_balance: true,
            no_refund_issued: true,
            // Clear dispatch lock so admin retry can re-call the provider.
            dispatched_at: null,
            provider_dispatched_at: null,
            flagged_suspicious: meta.flagged_suspicious ?? false,
          },
        })
        .eq("id", input.transactionId);
      return;
    }


    // Generic failure — refund the customer and mark failed.
    await supabaseAdmin
      .from("transactions")
      .update({
        status: "failed",
        metadata: {
          ...meta,
          provider: "swiftdata",
          provider_package_id: providerPackageId,
          http: res.status,
          provider_response: body,
          provider_error: body?.message ?? body?.error ?? "Provider rejected the order",
          no_refund_issued: false,
        },
      })
      .eq("id", input.transactionId);
    await refund(userId, amount);
  } catch (e: any) {
    await supabaseAdmin
      .from("transactions")
      .update({
        metadata: {
          ...meta,
          provider: "swiftdata",
          provider_package_id: providerPackageId,
          provider_error: String(e?.message ?? e),
        },
      })
      .eq("id", input.transactionId);
  }
}
