import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({ reference: z.string().min(4).max(120) });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/public/v1/activation/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return json({ error: "Invalid input" }, 400);

        const { data: existing } = await supabaseAdmin
          .from("activation_payments").select("status,kind").eq("reference", parsed.data.reference).maybeSingle();
        if (!existing) return json({ error: "Reference not found" }, 404);
        if (existing.status === "completed") return json({ status: "completed", kind: existing.kind });

        const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(parsed.data.reference)}`, {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        });
        const v: any = await res.json();
        if (!res.ok || !v.status) return json({ error: v.message ?? "Verification failed" }, 502);
        if (v.data.status !== "success") return json({ status: v.data.status });

        const { error } = await supabaseAdmin.rpc("mark_activation_completed", { _reference: parsed.data.reference });
        if (error) return json({ error: error.message }, 500);
        return json({ status: "completed", kind: existing.kind });
      },
    },
  },
});
