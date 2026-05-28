import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchDataPurchase } from "@/lib/data-provider.server";

const Schema = z.object({
  network: z.enum(["mtn", "airteltigo_ishare", "airteltigo_bigtime", "telecel"]),
  phone: z.string().regex(/^0\d{9}$/),
  size_mb: z.number().int().positive(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authUser(req: Request): Promise<{ userId: string } | null> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: key } = await supabaseAdmin
    .from("api_keys").select("user_id,revoked,id").eq("key_hash", hash).maybeSingle();
  if (!key || key.revoked) return null;
  await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
  return { userId: key.user_id as string };
}

export const Route = createFileRoute("/api/public/v1/data/purchase")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authUser(request);
        if (!auth) return json({ error: "Unauthorized" }, 401);

        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.issues }, 400);

        // Find matching active package
        const { data: pkg } = await supabaseAdmin
          .from("data_packages")
          .select("*")
          .eq("network", parsed.data.network)
          .eq("size_mb", parsed.data.size_mb)
          .eq("active", true)
          .order("price", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!pkg) return json({ error: "Package not available" }, 404);

        const { data: txId, error } = await supabaseAdmin.rpc("purchase_data", {
          _user_id: auth.userId,
          _package_id: pkg.id,
          _phone: parsed.data.phone,
        });
        if (error) return json({ error: error.message }, 400);

        await dispatchDataPurchase({
          transactionId: txId as string,
          userId: auth.userId,
          network: pkg.network as string,
          phone: parsed.data.phone,
          sizeMb: pkg.size_mb,
          amount: Number(pkg.price),
        });

        const { data: tx } = await supabaseAdmin
          .from("transactions").select("id,status,amount").eq("id", txId).single();
        return json({ transaction_id: tx?.id, status: tx?.status, amount: tx?.amount });
      },
    },
  },
});
