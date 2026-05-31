import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/v1/track-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch { return json({ error: "Invalid body" }, 400); }
        const raw = String(body?.phone ?? "").trim();
        const phone = raw.replace(/\D/g, "");
        if (!/^0\d{9}$/.test(phone)) return json({ error: "Enter a valid 10-digit phone number" }, 400);

        // Last 30 days, latest 25 orders for this recipient phone.
        const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
        const { data, error } = await supabaseAdmin
          .from("transactions")
          .select("id,type,status,amount,description,network,recipient_phone,created_at,updated_at,package_id")
          .eq("recipient_phone", phone)
          .in("type", ["data_purchase", "checker_purchase"])
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(25);
        if (error) return json({ error: error.message }, 500);

        const pkgIds = Array.from(new Set((data ?? []).map((t: any) => t.package_id).filter(Boolean)));
        let pkgMap = new Map<string, { size_label: string }>();
        if (pkgIds.length) {
          const { data: pkgs } = await supabaseAdmin
            .from("data_packages").select("id,size_label").in("id", pkgIds);
          pkgMap = new Map((pkgs ?? []).map((p: any) => [p.id, { size_label: p.size_label }]));
        }

        const orders = (data ?? []).map((t: any) => ({
          id: t.id,
          type: t.type,
          status: t.status,
          amount: Number(t.amount),
          network: t.network,
          size_label: t.package_id ? pkgMap.get(t.package_id)?.size_label ?? null : null,
          description: t.description,
          recipient_phone: t.recipient_phone,
          created_at: t.created_at,
          updated_at: t.updated_at,
        }));
        return json({ phone, count: orders.length, orders });
      },
    },
  },
});
