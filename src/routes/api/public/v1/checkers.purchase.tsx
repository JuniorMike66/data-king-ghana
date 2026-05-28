import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  checker_id: z.string().uuid(),
  phone: z.string().regex(/^0\d{9}$/),
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

export const Route = createFileRoute("/api/public/v1/checkers/purchase")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authUser(request);
        if (!auth) return json({ error: "Unauthorized" }, 401);
        const { data } = await supabaseAdmin
          .from("result_checkers").select("id,name,description,price").eq("active", true).order("price");
        return json({ checkers: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await authUser(request);
        if (!auth) return json({ error: "Unauthorized" }, 401);

        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.issues }, 400);

        const { data: txId, error } = await supabaseAdmin.rpc("purchase_checker", {
          _user_id: auth.userId,
          _checker_id: parsed.data.checker_id,
          _phone: parsed.data.phone,
        });
        if (error) return json({ error: error.message }, 400);

        const { data: tx } = await supabaseAdmin
          .from("transactions").select("id,status,amount").eq("id", txId).single();
        return json({ transaction_id: tx?.id, status: tx?.status, amount: tx?.amount });
      },
    },
  },
});
