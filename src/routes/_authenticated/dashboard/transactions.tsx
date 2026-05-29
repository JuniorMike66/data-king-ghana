import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/dashboard/transactions")({ component: Tx });

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-500",
  completed: "bg-emerald-500/15 text-emerald-500",
  success: "bg-emerald-500/15 text-emerald-500",
  failed: "bg-destructive/15 text-destructive",
  refunded: "bg-sky-500/15 text-sky-500",
};


function Tx() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*")
        .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(300);
      return data ?? [];
    },
  });
  const filtered = (data ?? []).filter((t) =>
    !q || t.description?.toLowerCase().includes(q.toLowerCase()) || t.reference?.toLowerCase().includes(q.toLowerCase()) || t.recipient_phone?.includes(q)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Description</th><th className="p-3">Amount</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No transactions yet.</td></tr>
            )}
            {filtered.map((t) => {
              // Customers only ever see "success" on their orders — real status
              // lives on the admin dashboard. Wallet top-ups & withdrawals keep
              // their actual status so users can see top-ups land.
              const display =
                t.type === "wallet_topup" || t.type === "withdrawal" || t.type === "refund"
                  ? t.status
                  : "success";
              return (
              <tr key={t.id}>
                <td className="p-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                <td className="p-3 capitalize">{t.type.replace("_", " ")}</td>
                <td className="p-3">{t.description ?? "—"}</td>
                <td className="p-3 font-semibold">GH₵{Number(t.amount).toFixed(2)}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColor[display] ?? statusColor.completed}`}>{display}</span></td>
              </tr>
              );
            })}

          </tbody>
        </table>
      </div>
    </div>
  );
}
