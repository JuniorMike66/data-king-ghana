import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addPaystackFee } from "@/lib/paystack-fees";

const Schema = z.object({
  user_id: z.string().uuid(),
  kind: z.enum(["store", "subagent"]),
  email: z.string().email().max(120),
  origin: z.string().url(),
  return_path: z.string().min(1).max(120),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/public/v1/activation/init")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.issues }, 400);
        const { user_id, kind, email, origin, return_path } = parsed.data;

        const { data: settings } = await supabaseAdmin
          .from("site_settings").select("*").eq("id", 1).maybeSingle();
        if (!settings) return json({ error: "Site settings missing" }, 500);

        let amount = 0;
        let sponsorMarkup = 0;
        let sponsorId: string | null = null;

        if (kind === "store") {
          if (!settings.store_activation_enabled) return json({ error: "Store activation is not required" }, 400);
          amount = Number(settings.store_activation_fee ?? 0);
        } else {
          if (!settings.subagent_activation_enabled) return json({ error: "Subagent activation is not required" }, 400);
          const { data: profile } = await supabaseAdmin
            .from("profiles").select("sponsor_id").eq("id", user_id).maybeSingle();
          if (!profile?.sponsor_id) return json({ error: "Not a subagent" }, 400);
          sponsorId = profile.sponsor_id;
          const { data: markup } = await supabaseAdmin
            .from("subagent_activation_markup").select("markup").eq("sponsor_id", profile.sponsor_id).maybeSingle();
          sponsorMarkup = Number(markup?.markup ?? 0);
          amount = Number(settings.subagent_activation_base_fee ?? 0) + sponsorMarkup;
        }

        if (amount <= 0) return json({ error: "Activation fee is zero — no payment required" }, 400);

        const reference = `ACT-${kind.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const callback_url = `${origin}${return_path}?act_ref=${encodeURIComponent(reference)}`;

        const { error: insertErr } = await supabaseAdmin.from("activation_payments").insert({
          user_id, kind, amount, sponsor_markup: sponsorMarkup, sponsor_id: sponsorId, reference, status: "pending",
        });
        if (insertErr) return json({ error: insertErr.message }, 500);

        const { gross, fee } = addPaystackFee(amount);

        const res = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            amount: Math.round(gross * 100),
            currency: "GHS",
            reference,
            callback_url,
            channels: ["mobile_money", "card"],
            metadata: { kind: "activation", activation_kind: kind, user_id, sponsor_id: sponsorId, sponsor_markup: sponsorMarkup, net_amount: amount, paystack_fee: fee },
          }),
        });
        const init: any = await res.json();
        if (!res.ok || !init.status) return json({ error: init.message ?? "Paystack init failed" }, 502);
        return json({ authorization_url: init.data.authorization_url, reference, total: gross, fee });
      },
    },
  },
});
