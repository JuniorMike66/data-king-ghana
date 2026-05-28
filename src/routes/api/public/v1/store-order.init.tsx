import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  store_slug: z.string().min(1).max(60),
  package_id: z.string().uuid(),
  recipient_phone: z.string().regex(/^0\d{9}$/),
  customer_email: z.string().email().max(120),
  origin: z.string().url(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/public/v1/store-order/init")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.issues }, 400);
        const { store_slug, package_id, recipient_phone, customer_email, origin } = parsed.data;

        const { data: store } = await supabaseAdmin
          .from("stores").select("id,user_id,name,active,sponsor_id").eq("slug", store_slug).maybeSingle();
        if (!store || !store.active) return json({ error: "Store not available" }, 404);

        const { data: pkg } = await supabaseAdmin
          .from("data_packages").select("*").eq("id", package_id).eq("active", true).maybeSingle();
        if (!pkg) return json({ error: "Package not available" }, 404);

        const { data: override } = await supabaseAdmin
          .from("store_package_prices").select("price").eq("store_id", store.id).eq("package_id", package_id).maybeSingle();
        let basePrice = Number(pkg.price);
        if (store.sponsor_id) {
          const { data: sp } = await supabaseAdmin
            .from("subagent_prices").select("price").eq("sponsor_id", store.sponsor_id).eq("package_id", package_id).maybeSingle();
          if (sp) basePrice = Number(sp.price);
        }
        const price = Number(override?.price ?? basePrice);


        const reference = `SO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const callback_url = `${origin}/s/${store_slug}?reference=${encodeURIComponent(reference)}`;

        const res = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: customer_email,
            amount: Math.round(price * 100),
            currency: "GHS",
            reference,
            callback_url,
            channels: ["mobile_money", "card"],
            metadata: {
              kind: "store_order",
              store_id: store.id,
              store_owner_id: store.user_id,
              package_id,
              recipient_phone,
              price,
            },
          }),
        });
        const init: any = await res.json();
        if (!res.ok || !init.status) return json({ error: init.message ?? "Paystack init failed" }, 502);
        return json({ authorization_url: init.data.authorization_url, reference });
      },
    },
  },
});
