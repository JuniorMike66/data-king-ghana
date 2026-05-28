import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchDataPurchase } from "@/lib/data-provider.server";

const Schema = z.object({ reference: z.string().min(4).max(80) });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/public/v1/store-order/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid input" }, 400);

        // Idempotency: if already processed, return it
        const { data: existing } = await supabaseAdmin
          .from("transactions").select("id,status,amount").eq("reference", parsed.data.reference).maybeSingle();
        if (existing) return json({ status: existing.status, transaction_id: existing.id, amount: existing.amount });

        const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(parsed.data.reference)}`, {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        });
        const v: any = await res.json();
        if (!res.ok || !v.status) return json({ error: v.message ?? "Verification failed" }, 502);
        if (v.data.status !== "success") return json({ status: v.data.status });

        const meta = v.data.metadata ?? {};
        if (meta.kind !== "store_order") return json({ error: "Wrong reference kind" }, 400);

        const { data: pkg } = await supabaseAdmin
          .from("data_packages").select("network,size_mb,size_label,price").eq("id", meta.package_id).maybeSingle();
        if (!pkg) return json({ error: "Package missing" }, 404);

        const amount = Number(v.data.amount) / 100;
        const { data: txRow, error: txErr } = await supabaseAdmin.from("transactions").insert({
          user_id: meta.store_owner_id,
          type: "data_purchase",
          status: "pending",
          amount,
          network: pkg.network,
          package_id: meta.package_id,
          recipient_phone: meta.recipient_phone,
          reference: parsed.data.reference,
          description: `${pkg.size_label} for ${meta.recipient_phone} (store order)`,
          metadata: {
            source: "store_order",
            store_id: meta.store_id,
            store_sponsor_id: meta.store_sponsor_id ?? null,
            cost: meta.cost ?? null,
            customer_email: v.data.customer?.email ?? null,
            paystack: { channel: v.data.channel, paid_at: v.data.paid_at },
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

        const { data: final } = await supabaseAdmin
          .from("transactions").select("status").eq("id", txRow.id).single();
        return json({ status: final?.status ?? "pending", transaction_id: txRow.id, amount });
      },
    },
  },
});
