import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
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

export const Route = createFileRoute("/api/public/v1/balance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authUser(request);
        if (!auth) return json({ error: "Unauthorized" }, 401);
        const { data: w } = await supabaseAdmin
          .from("wallets").select("balance").eq("user_id", auth.userId).maybeSingle();
        return json({ balance: Number(w?.balance ?? 0), currency: "GHS" });
      },
    },
  },
});
