import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchDataPurchase } from "@/lib/data-provider.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/public/v1/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return json({ error: "Server misconfigured" }, 500);

        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
        const sigBuf = Buffer.from(signature, "utf8");
        const expBuf = Buffer.from(expected, "utf8");
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          return json({ error: "Invalid signature" }, 401);
        }

        let event: any;
        try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
        if (event?.event !== "charge.success") return json({ ok: true });

        const tx = event.data ?? {};
        const reference: string = tx.reference;
        const meta = tx.metadata ?? {};
        const gatewayEventId = String(tx.id ?? `evt-${reference}`);

        // ===== ACTIVATION =====
        if (meta.kind === "activation") {
          const { error } = await supabaseAdmin.rpc("mark_activation_completed", { _reference: reference });
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true, kind: "activation" });
        }

        // ===== WALLET TOPUP =====
        if (meta.kind === "wallet_topup" && meta.user_id) {
          // New flow: row already exists in pending_payment state.
          const { data: existing } = await supabaseAdmin
            .from("transactions").select("id,status").eq("reference", reference).maybeSingle();

          if (existing) {
            if (existing.status === "completed") return json({ ok: true, deduped: true });
            const { error } = await supabaseAdmin.rpc("complete_wallet_topup", {
              _reference: reference,
              _gateway_event_id: gatewayEventId,
              _channel: tx.channel ?? "mobile_money",
            });
            if (error) return json({ error: error.message }, 500);
            return json({ ok: true, kind: "wallet_topup" });
          }

          // Legacy fallback (hosted-page flow that didn't pre-insert).
          const amount = Number(meta.net_amount ?? (Number(tx.amount) / 100));
          const { error } = await supabaseAdmin.rpc("credit_wallet", {
            _user_id: meta.user_id,
            _amount: amount,
            _reference: reference,
            _description: `Wallet top-up via Paystack (${tx.channel ?? "online"})`,
          });
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true, kind: "wallet_topup", legacy: true });
        }

        // ===== STORE ORDER =====
        if (meta.kind === "store_order" && meta.store_owner_id && meta.package_id) {
          const { data: existing } = await supabaseAdmin
            .from("transactions").select("id,status,metadata,package_id,recipient_phone,amount")
            .eq("reference", reference).maybeSingle();

          let txId: string;
          if (existing) {
            if ((existing.metadata as any)?.provider_dispatched_at) {
              return json({ ok: true, deduped: true });
            }
            const { error } = await supabaseAdmin.rpc("mark_store_order_paid", {
              _reference: reference,
              _gateway_event_id: gatewayEventId,
              _channel: tx.channel ?? "mobile_money",
            });
            if (error) return json({ error: error.message }, 500);
            txId = existing.id;
          } else {
            // Legacy fallback for hosted-page flow without pre-insert.
            const { data: pkg } = await supabaseAdmin
              .from("data_packages").select("network,size_mb,size_label").eq("id", meta.package_id).maybeSingle();
            if (!pkg) return json({ error: "Package missing" }, 404);
            const amount = Number(meta.net_amount ?? (Number(tx.amount) / 100));
            const { data: txRow, error: txErr } = await supabaseAdmin.from("transactions").insert({
              user_id: meta.store_owner_id,
              type: "data_purchase",
              status: "pending",
              amount,
              network: pkg.network,
              package_id: meta.package_id,
              recipient_phone: meta.recipient_phone,
              reference,
              gateway_event_id: gatewayEventId,
              description: `${pkg.size_label} for ${meta.recipient_phone} (store order)`,
              metadata: {
                source: "store_order",
                store_id: meta.store_id,
                store_sponsor_id: meta.store_sponsor_id ?? null,
                cost: meta.cost ?? null,
                customer_email: tx.customer?.email ?? null,
                paystack_channel: tx.channel,
                paid_at: tx.paid_at,
                provider_dispatched_at: new Date().toISOString(),
              },
            }).select("id").single();
            if (txErr) return json({ error: txErr.message }, 500);
            txId = txRow.id as string;
          }

          // Now dispatch (only one webhook delivery wins the dispatch race because
          // we set provider_dispatched_at before calling out).
          const { data: row } = await supabaseAdmin
            .from("transactions")
            .select("metadata,package_id,recipient_phone,amount")
            .eq("id", txId).single();
          if (row && !(row.metadata as any)?.provider_dispatched_at) {
            await supabaseAdmin.from("transactions")
              .update({ metadata: { ...(row.metadata as any ?? {}), provider_dispatched_at: new Date().toISOString() } })
              .eq("id", txId);
            const { data: pkg } = await supabaseAdmin
              .from("data_packages").select("network,size_mb").eq("id", row.package_id!).maybeSingle();
            if (pkg) {
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
          return json({ ok: true, kind: "store_order" });
        }

        return json({ ok: true, ignored: true });
      },
    },
  },
});
