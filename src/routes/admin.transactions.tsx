import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminListAllTransactions } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/transactions")({ component: TransactionsPage });

const TYPE_LABEL: Record<string, string> = {
  wallet_topup: "Wallet Top-up",
  data_purchase: "Data Order",
  checker_purchase: "Result Checker",
  withdrawal: "Withdrawal",
  refund: "Refund",
};

function TransactionsPage() {
  const list = useServerFn(adminListAllTransactions);
  const { data, isLoading } = useQuery({ queryKey: ["admin-transactions"], queryFn: () => list() });
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");

  const rows = useMemo(() => {
    const all = (data ?? []) as any[];
    return all.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return (
        (t.user_email ?? "").toLowerCase().includes(s) ||
        (t.user_name ?? "").toLowerCase().includes(s) ||
        (t.recipient_phone ?? "").includes(s) ||
        (t.reference ?? "").toLowerCase().includes(s) ||
        (t.description ?? "").toLowerCase().includes(s)
      );
    });
  }, [data, q, type]);

  const totals = useMemo(() => {
    let topup = 0, orders = 0;
    for (const t of rows) {
      if (t.status !== "completed" && t.status !== "pending") continue;
      if (t.type === "wallet_topup") topup += Number(t.amount);
      if (t.type === "data_purchase" || t.type === "checker_purchase") orders += Number(t.amount);
    }
    return { topup, orders };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground text-sm">
          Every payment across the platform — wallet top-ups, data orders, checker purchases — with the user who made it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Top-ups (filtered)</div>
          <div className="text-xl font-bold">GH₵{totals.topup.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Orders (filtered)</div>
          <div className="text-xl font-bold">GH₵{totals.orders.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Rows</div>
          <div className="text-xl font-bold">{rows.length}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Search by user, phone, reference…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-sm" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="wallet_topup">Wallet Top-ups</SelectItem>
            <SelectItem value="data_purchase">Data Orders</SelectItem>
            <SelectItem value="checker_purchase">Result Checkers</SelectItem>
            <SelectItem value="withdrawal">Withdrawals</SelectItem>
            <SelectItem value="refund">Refunds</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase">
            <tr>
              <th className="p-3">Date & Time</th>
              <th className="p-3">User</th>
              <th className="p-3">Type</th>
              <th className="p-3">Details</th>
              <th className="p-3">Reference</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No transactions match.</td></tr>
            )}
            {rows.map((t: any) => (
              <tr key={t.id}>
                <td className="p-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                <td className="p-3">
                  <div className="font-medium">{t.user_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{t.user_email ?? t.user_id}</div>
                  {t.is_subagent && <div className="text-[10px] uppercase tracking-wide text-primary mt-0.5">Subagent</div>}
                </td>
                <td className="p-3">{TYPE_LABEL[t.type] ?? t.type}</td>
                <td className="p-3">
                  <div>{t.description ?? "—"}</div>
                  {t.recipient_phone && <div className="text-xs text-muted-foreground font-mono">{t.recipient_phone}</div>}
                </td>
                <td className="p-3 font-mono text-xs">{t.reference ?? "—"}</td>
                <td className="p-3 font-bold whitespace-nowrap">GH₵{Number(t.amount).toFixed(2)}</td>
                <td className="p-3 capitalize">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
