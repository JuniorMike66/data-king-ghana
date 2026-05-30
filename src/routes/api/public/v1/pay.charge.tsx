import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addPaystackFee } from "@/lib/paystack-fees";

const MomoSchema = z.object({
  phone: z.string().regex(/^0\d{9}$/, "Enter a 10-digit MoMo number"),
  provider: z.enum(["mtn", "vod", "atl"]),
});

const WalletTopupSchema = z.object({
  kind: z.literal("wallet_topup"),
  amount: z.number().min(1).max(10000),
  user_id: z.string().uuid(),
  email: z.string().email().max(120),
  momo: MomoSchema,
});

const StoreOrderSchema = z.object({
  kind: z.literal("store_order"),
  store_slug: z.string().min(1).max(60),
  package_id: z.string().uuid(),
  recipient_phone: z.string().regex(/^0\d{9}$/),
  customer_email: z.string().email().max(120),
  momo: MomoSchema,
});

const ActivationSchema = z.object({
  kind: z.literal("activation"),
  activation_kind: z.enum(["store", "subagent"]),
  user_id: z.string().uuid(),
  email: z.string().email().max(120),
  momo: MomoSchema,
});

const Schema = z.discriminatedUnion("kind", [WalletTopupSchema, StoreOrderSchema, ActivationSchema]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function ref(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function paystackCharge(payload: any) {
  const res = await fetch("https://api.paystack.co/charge", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const j: any = await res.json();
  return { ok: res.ok, body: j };
}

export const Route = createFileRoute("/api/public/v1/pay/charge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.issues }, 400);
        const input = parsed.data;

        // ============= WALLET TOPUP =============
        if (input.kind === "wallet_topup") {
          const reference = ref("DK");
          const { gross, fee } = addPaystackFee(input.amount);

          // Pre-insert pending_payment row so admin sees the attempt immediately.
          const { error: txErr } = await supabaseAdmin.from("transactions").insert({
            user_id: input.user_id,
            type: "wallet_topup",
            status: "pending_payment",
            amount: input.amount,
            reference,
            description: `Wallet top-up (MoMo ${input.momo.provider.toUpperCase()}) — awaiting payment`,
            metadata: { kind: "wallet_topup", momo: input.momo, paystack_fee: fee, gross },
          });
          if (txErr) return json({ error: txErr.message }, 500);

          const charge = await paystackCharge({
            email: input.email,
            amount: Math.round(gross * 100),
            currency: "GHS",
            reference,
            mobile_money: { phone: input.momo.phone, provider: input.momo.provider },
            metadata: {
              kind: "wallet_topup",
              user_id: input.user_id,
              net_amount: input.amount,
              paystack_fee: fee,
            },
          });
          if (!charge.ok || !charge.body?.status) {
            await supabaseAdmin.from("transactions")
              .update({ status: "failed", description: charge.body?.message ?? "Paystack charge failed", updated_at: new Date().toISOString() })
              .eq("reference", reference);
            return json({ error: charge.body?.message ?? "Paystack charge failed", reference }, 502);
          }
          return json({
            reference,
            status: charge.body.data?.status,
            display_text: charge.body.data?.display_text ?? null,
            gross, fee,
          });
        }

        // ============= STORE ORDER =============
        if (input.kind === "store_order") {
          const { data: store } = await supabaseAdmin
            .from("stores").select("id,user_id,name,active,sponsor_id").eq("slug", input.store_slug).maybeSingle();
          if (!store || !store.active) return json({ error: "Store not available" }, 404);

          const { data: pkg } = await supabaseAdmin
            .from("data_packages").select("*").eq("id", input.package_id).eq("active", true).maybeSingle();
          if (!pkg) return json({ error: "Package not available" }, 404);

          let cost = Number(pkg.agent_price ?? pkg.price);
          if (store.sponsor_id) {
            const { data: sp } = await supabaseAdmin
              .from("subagent_prices").select("price").eq("sponsor_id", store.sponsor_id).eq("package_id", input.package_id).maybeSingle();
            if (sp) cost = Number(sp.price);
          }
          const { data: override } = await supabaseAdmin
            .from("store_package_prices").select("price").eq("store_id", store.id).eq("package_id", input.package_id).maybeSingle();
          const price = Number(override?.price ?? cost);

          const reference = ref("SO");
          const { gross, fee } = addPaystackFee(price);

          const { error: txErr } = await supabaseAdmin.from("transactions").insert({
            user_id: store.user_id,
            type: "data_purchase",
            status: "pending_payment",
            amount: price,
            network: pkg.network,
            package_id: input.package_id,
            recipient_phone: input.recipient_phone,
            reference,
            description: `${pkg.size_label} for ${input.recipient_phone} (store order — awaiting payment)`,
            metadata: {
              source: "store_order",
              store_id: store.id,
              store_sponsor_id: store.sponsor_id ?? null,
              cost,
              customer_email: input.customer_email,
              momo: input.momo,
              paystack_fee: fee,
              gross,
            },
          });
          if (txErr) return json({ error: txErr.message }, 500);

          const charge = await paystackCharge({
            email: input.customer_email,
            amount: Math.round(gross * 100),
            currency: "GHS",
            reference,
            mobile_money: { phone: input.momo.phone, provider: input.momo.provider },
            metadata: {
              kind: "store_order",
              store_id: store.id,
              store_owner_id: store.user_id,
              store_sponsor_id: store.sponsor_id ?? null,
              package_id: input.package_id,
              recipient_phone: input.recipient_phone,
              price, cost,
              net_amount: price,
              paystack_fee: fee,
            },
          });
          if (!charge.ok || !charge.body?.status) {
            await supabaseAdmin.from("transactions")
              .update({ status: "failed", description: charge.body?.message ?? "Paystack charge failed", updated_at: new Date().toISOString() })
              .eq("reference", reference);
            return json({ error: charge.body?.message ?? "Paystack charge failed", reference }, 502);
          }
          return json({
            reference,
            status: charge.body.data?.status,
            display_text: charge.body.data?.display_text ?? null,
            gross, fee,
          });
        }

        // ============= ACTIVATION =============
        // input.kind === "activation"
        const { data: settings } = await supabaseAdmin
          .from("site_settings").select("*").eq("id", 1).maybeSingle();
        if (!settings) return json({ error: "Site settings missing" }, 500);

        let amount = 0;
        let sponsorMarkup = 0;
        let sponsorId: string | null = null;

        if (input.activation_kind === "store") {
          if (!settings.store_activation_enabled) return json({ error: "Store activation is not required" }, 400);
          amount = Number(settings.store_activation_fee ?? 0);
        } else {
          if (!settings.subagent_activation_enabled) return json({ error: "Subagent activation is not required" }, 400);
          const { data: profile } = await supabaseAdmin
            .from("profiles").select("sponsor_id").eq("id", input.user_id).maybeSingle();
          if (!profile?.sponsor_id) return json({ error: "Not a subagent" }, 400);
          sponsorId = profile.sponsor_id;
          const { data: markup } = await supabaseAdmin
            .from("subagent_activation_markup").select("markup").eq("sponsor_id", profile.sponsor_id).maybeSingle();
          sponsorMarkup = Number(markup?.markup ?? 0);
          amount = Number(settings.subagent_activation_base_fee ?? 0) + sponsorMarkup;
        }
        if (amount <= 0) return json({ error: "Activation fee is zero — no payment required" }, 400);

        const reference = `ACT-${input.activation_kind.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const { gross, fee } = addPaystackFee(amount);

        const { error: insertErr } = await supabaseAdmin.from("activation_payments").insert({
          user_id: input.user_id, kind: input.activation_kind, amount,
          sponsor_markup: sponsorMarkup, sponsor_id: sponsorId, reference, status: "pending",
        });
        if (insertErr) return json({ error: insertErr.message }, 500);

        const charge = await paystackCharge({
          email: input.email,
          amount: Math.round(gross * 100),
          currency: "GHS",
          reference,
          mobile_money: { phone: input.momo.phone, provider: input.momo.provider },
          metadata: {
            kind: "activation",
            activation_kind: input.activation_kind,
            user_id: input.user_id,
            sponsor_id: sponsorId,
            sponsor_markup: sponsorMarkup,
            net_amount: amount,
            paystack_fee: fee,
          },
        });
        if (!charge.ok || !charge.body?.status) {
          await supabaseAdmin.from("activation_payments")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("reference", reference);
          return json({ error: charge.body?.message ?? "Paystack charge failed", reference }, 502);
        }
        return json({
          reference,
          status: charge.body.data?.status,
          display_text: charge.body.data?.display_text ?? null,
          gross, fee,
        });
      },
    },
  },
});
