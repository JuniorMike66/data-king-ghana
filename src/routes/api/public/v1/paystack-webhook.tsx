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
        // timing-safe compare
        const sigBuf = Buffer.from(signature, "utf8");
        const expBuf = Buffer.from(expected, "utf8");
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          return json({ error: "Invalid signature" }, 401);
        }

        let event: any;
        try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }

        // Only act on successful charges. Other events ack with 200 so Paystack doesn't retry.
        if (event?.event !== "charge.success") return json({ ok: true });

        const tx = event.data ?? {};
        const reference: string = tx.reference;
        const meta = tx.metadata ?? {};
        const amount = Number(tx.amount) / 100;

        // Activation payments (separate ledger from transactions)
        if (meta.kind === "activation") {
          const { error } = await supabaseAdmin.rpc("mark_activation_completed", { _reference: reference });
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true, kind: "activation" });
        }

        // Idempotency — both flows record `reference` on the transactions row.
        const { data: existing } = await supabaseAdmin
          .from("transactions").select("id").eq("reference", reference).maybeSingle();
        if (existing) return json({ ok: true, deduped: true });

        if (meta.kind === "wallet_topup" && meta.user_id) {
          const { error } = await supabaseAdmin.rpc("credit_wallet", {
            _user_id: meta.user_id,
            _amount: amount,
            _reference: reference,
            _description: `Wallet top-up via Paystack (${tx.channel ?? "online"})`,
          });
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true, kind: "wallet_topup" });
        }

        if (meta.kind === "store_order" && meta.store_owner_id && meta.package_id) {
          const { data: pkg } = await supabaseAdmin
            .from("data_packages").select("network,size_mb,size_label").eq("id", meta.package_id).maybeSingle();
          if (!pkg) return json({ error: "Package missing" }, 404);

          const { data: txRow, error: txErr } = await supabaseAdmin.from("transactions").insert({
            user_id: meta.store_owner_id,
            type: "data_purchase",
            status: "pending",
            amount,
            network: pkg.network,
            package_id: meta.package_id,
            recipient_phone: meta.recipient_phone,
            reference,
            description: `${pkg.size_label} for ${meta.recipient_phone} (store order)`,
            metadata: {
              source: "store_order",
              store_id: meta.store_id,
              store_sponsor_id: meta.store_sponsor_id ?? null,
              cost: meta.cost ?? null,
              customer_email: tx.customer?.email ?? null,
              paystack: { channel: tx.channel, paid_at: tx.paid_at },
            },
          }).select("id").single();

          if (txErr) return json({ error: txErr.message }, 500);

          await dispatchDataPurchase({
            transactionId: txRow.id as string,
            userId: meta.store_owner_id,
            network: pkg.network as string,
            phone: meta.recipient_phone,
            sizeMb: pkg.size_mb,
            amount,
          });
          return json({ ok: true, kind: "store_order" });
        }

        // Unknown kind — ack so Paystack stops retrying, but don't insert anything.
        return json({ ok: true, ignored: true });
      },
    },
  },
});
