import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetUserDetail } from "@/lib/admin.functions";
import { ArrowLeft, Wallet, ShoppingBag, Receipt, Users, Store, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/users/$userId")({ component: UserDetail });

function statusBadge(s: string) {
  const map: Record<string, string> = {
    completed: "bg-green-500/15 text-green-500",
    pending: "bg-amber-500/15 text-amber-500",
    failed: "bg-destructive/15 text-destructive",
    refunded: "bg-blue-500/15 text-blue-500",
  };
  return `px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[s] ?? "bg-muted"}`;
}

function UserDetail() {
  const { userId } = useParams({ from: "/admin/users/$userId" });
  const get = useServerFn(adminGetUserDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: () => get({ data: { userId } }),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!data) return <div className="p-6 text-muted-foreground">User not found.</div>;

  const { profile, stores, transactions, subagents, overview } = data;

  return (
    <div className="space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to users
      </Link>

      {/* Profile header */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{profile.full_name ?? "—"}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${profile.role === "admin" ? "bg-primary/20 text-primary" : profile.sponsor_id ? "bg-blue-500/15 text-blue-500" : "bg-muted"}`}>
              {profile.role === "admin" ? "ADMIN" : profile.sponsor_id ? "SUBAGENT" : "USER"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">{profile.email}</div>
          <div className="text-sm text-muted-foreground">{profile.phone ?? "No phone"}</div>
          <div className="text-xs text-muted-foreground mt-2">Joined {new Date(profile.created_at).toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Wallet balance</div>
          <div className="text-3xl font-extrabold text-primary">GH₵{profile.balance.toFixed(2)}</div>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={ShoppingBag} label="Total orders" value={overview.total_orders} />
        <Stat icon={Wallet} label="Total spent" value={`GH₵${overview.total_spent.toFixed(2)}`} />
        <Stat icon={Receipt} label="Total top-ups" value={`GH₵${overview.total_topups.toFixed(2)}`} />
        <Stat icon={XCircle} label="Failed orders" value={overview.failed_orders} tone="destructive" />
      </div>

      {/* Stores */}
      <Section icon={Store} title={`Stores (${stores.length})`}>
        {stores.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No store created yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase"><tr>
              <th className="p-3">Name</th><th className="p-3">Slug</th><th className="p-3">Status</th><th className="p-3">Created</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {stores.map((s: any) => (
                <tr key={s.id}>
                  <td className="p-3 font-semibold">{s.name}</td>
                  <td className="p-3"><a href={`/s/${s.slug}`} target="_blank" className="text-primary hover:underline">/s/{s.slug}</a></td>
                  <td className="p-3">{s.active ? "Active" : "Inactive"}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Subagents */}
      <Section icon={Users} title={`Subagents under this user (${subagents.length})`}>
        {subagents.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No subagents recruited yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase"><tr>
              <th className="p-3">Subagent</th><th className="p-3">Phone</th><th className="p-3">Balance</th><th className="p-3">Orders</th><th className="p-3">Spent</th><th className="p-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {subagents.map((s: any) => (
                <tr key={s.id}>
                  <td className="p-3"><div className="font-semibold">{s.full_name ?? "—"}</div><div className="text-xs text-muted-foreground">{s.email}</div></td>
                  <td className="p-3">{s.phone ?? "—"}</td>
                  <td className="p-3 font-bold">GH₵{s.balance.toFixed(2)}</td>
                  <td className="p-3">{s.orders}</td>
                  <td className="p-3">GH₵{s.total_spent.toFixed(2)}</td>
                  <td className="p-3 text-right">
                    <Link to="/admin/users/$userId" params={{ userId: s.id }} className="text-primary text-xs hover:underline">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Transactions */}
      <Section icon={Receipt} title={`Recent transactions (${transactions.length})`}>
        {transactions.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase"><tr>
              <th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Description</th><th className="p-3">Amount</th><th className="p-3">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {transactions.map((t: any) => (
                <tr key={t.id}>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="p-3 text-xs">{t.type}</td>
                  <td className="p-3">{t.description ?? "—"}{t.recipient_phone && <span className="text-xs text-muted-foreground"> · {t.recipient_phone}</span>}</td>
                  <td className="p-3 font-bold">GH₵{Number(t.amount).toFixed(2)}</td>
                  <td className="p-3"><span className={statusBadge(t.status)}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className={`w-5 h-5 mb-2 ${tone === "destructive" ? "text-destructive" : "text-primary"}`} />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4 text-primary" /><h2 className="font-bold">{title}</h2></div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">{children}</div>
    </div>
  );
}
