import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchDataPurchase } from "@/lib/data-provider.server";

const Schema = z.object({ reference: z.string().min(4).max(80) });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Polls Paystack /transaction/verify/{reference} and finalizes the matching
 * record (wallet topup / store order / activation) if it became successful.
 *
 * This is idempotent and acts as the backstop when webhooks are dropped.
 */
export const Route = createFileRoute("/api/public/v1/pay/check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid input" }, 400);
        const reference = parsed.data.reference;

        const res = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
        );
        const v: any = await res.json();
        if (!res.ok || !v.status) return json({ error: v.message ?? "Verification failed" }, 502);

        const tx = v.data ?? {};
        const meta = tx.metadata ?? {};
        const paystackStatus: string = tx.status ?? "pending";
        const gatewayEventId: string = String(tx.id ?? `verify-${reference}`);

        // Pending / failed → just report status to the dialog.
        if (paystackStatus !== "success") {
          // Mark failures in the ledger so the admin can see them.
          if (paystackStatus === "failed" || paystackStatus === "abandoned") {
            if (meta.kind === "activation") {
              await supabaseAdmin.from("activation_payments")
                .update({ status: "failed", updated_at: new Date().toISOString() })
                .eq("reference", reference).eq("status", "pending");
            } else {
              await supabaseAdmin.from("transactions")
                .update({ status: "failed", description: `Payment ${paystackStatus}`, updated_at: new Date().toISOString() })
                .eq("reference", reference).eq("status", "pending_payment");
            }
          }
          return json({ status: paystackStatus });
        }

        // === SUCCESS — branch by kind ===
        if (meta.kind === "activation") {
          const { error } = await supabaseAdmin.rpc("mark_activation_completed", { _reference: reference });
          if (error) return json({ error: error.message }, 500);
          return json({ status: "success", kind: "activation" });
        }

        if (meta.kind === "wallet_topup" && meta.user_id) {
          const { error } = await supabaseAdmin.rpc("complete_wallet_topup", {
            _reference: reference,
            _gateway_event_id: gatewayEventId,
            _channel: tx.channel ?? "mobile_money",
          });
          if (error) return json({ error: error.message }, 500);
          return json({ status: "success", kind: "wallet_topup" });
        }

        if (meta.kind === "store_order" && meta.store_owner_id && meta.package_id) {
          const { data: txIdData, error } = await supabaseAdmin.rpc("mark_store_order_paid", {
            _reference: reference,
            _gateway_event_id: gatewayEventId,
            _channel: tx.channel ?? "mobile_money",
          });
          if (error) return json({ error: error.message }, 500);
          const txId = txIdData as string;

          // Only dispatch if we just flipped (i.e. provider hasn't been called).
          const { data: row } = await supabaseAdmin
            .from("transactions")
            .select("status,metadata,package_id,recipient_phone,amount")
            .eq("id", txId).single();

          if (row && row.status === "pending" && !(row.metadata as any)?.provider_dispatched_at) {
            const { data: pkg } = await supabaseAdmin
              .from("data_packages").select("network,size_mb").eq("id", row.package_id!).maybeSingle();
            if (pkg) {
              await supabaseAdmin.from("transactions")
                .update({ metadata: { ...(row.metadata as any ?? {}), provider_dispatched_at: new Date().toISOString() } })
                .eq("id", txId);
              await dispatchDataPurchase({
                transactionId: txId,
                userId: meta.store_owner_id,
                network: pkg.network as string,
                phone: row.recipient_phone ?? meta.recipient_phone,
                sizeMb: pkg.size_mb,
                amount: Number(row.amount),
              });
            }
          }
          return json({ status: "success", kind: "store_order" });
        }

        return json({ status: "success", kind: "unknown" });
      },
    },
  },
});
