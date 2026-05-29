import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addPaystackFee } from "@/lib/paystack-fees";

export const getPaystackPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.PAYSTACK_PUBLIC_KEY ?? "" };
});

export const initPaystackTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ amount: z.number().min(1).max(10000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const reference = `DK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: claims.email ?? `user-${userId}@dataking.gh`,
        amount: Math.round(data.amount * 100),
        currency: "GHS",
        reference,
        channels: ["mobile_money", "card"],
        metadata: { user_id: userId, kind: "wallet_topup" },
      }),
    });
    const json: any = await res.json();
    if (!res.ok || !json.status) throw new Error(json.message ?? "Paystack init failed");
    return { authorization_url: json.data.authorization_url, reference, access_code: json.data.access_code };
  });

export const verifyPaystackTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reference: z.string().min(4) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const json: any = await res.json();
    if (!res.ok || !json.status) throw new Error(json.message ?? "Verification failed");
    const tx = json.data;
    if (tx.status !== "success") return { credited: false, status: tx.status as string };
    if (tx.metadata?.user_id && tx.metadata.user_id !== userId) throw new Error("Reference does not belong to this user");
    const amount = Number(tx.amount) / 100;
    const { error } = await supabaseAdmin.rpc("credit_wallet", {
      _user_id: userId,
      _amount: amount,
      _reference: data.reference,
      _description: `Wallet top-up via Paystack (${tx.channel ?? "online"})`,
    });
    if (error) throw new Error(error.message);
    return { credited: true, amount, status: "success" };
  });
