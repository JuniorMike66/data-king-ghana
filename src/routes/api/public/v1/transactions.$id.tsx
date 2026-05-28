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
    .from("api_keys").select("user_id,revoked").eq("key_hash", hash).maybeSingle();
  if (!key || key.revoked) return null;
  return { userId: key.user_id as string };
}

export const Route = createFileRoute("/api/public/v1/transactions/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await authUser(request);
        if (!auth) return json({ error: "Unauthorized" }, 401);
        const { data: tx } = await supabaseAdmin
          .from("transactions")
          .select("id,type,status,amount,network,recipient_phone,description,created_at")
          .eq("id", params.id)
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (!tx) return json({ error: "Not found" }, 404);
        return json(tx);
      },
    },
  },
});
