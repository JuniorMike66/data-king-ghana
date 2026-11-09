import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ShoppingBag, Receipt, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/")({ component: Overview });

function Overview() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["overview", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: w }, { data: txs }] = await Promise.all([
        supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle(),
        supabase.from("transactions").select("amount,type,created_at,status").eq("user_id", user!.id),
      ]);
      const completed = (txs ?? []).filter((t) => t.status === "completed");
      const totalSales = completed.filter((t) => t.type === "data_purchase" || t.type === "checker_purchase").reduce((s, t) => s + Number(t.amount), 0);
      const totalOrders = completed.filter((t) => t.type === "data_purchase" || t.type === "checker_purchase").length;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const daily = completed.filter((t) => new Date(t.created_at) >= today).reduce((s, t) => s + Number(t.amount), 0);
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
      const weekly = completed.filter((t) => new Date(t.created_at) >= weekStart).reduce((s, t) => s + Number(t.amount), 0);
      return { balance: Number(w?.balance ?? 0), totalSales, totalOrders, daily, weekly };
    },
  });

  const balance = data?.balance ?? 0;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Overview</h1>
        <p className="text-muted-foreground">Welcome back to your DataKing dashboard.</p>
      </div>

      <section className="account-band flex flex-wrap items-center justify-between gap-6">
        <div><div className="flex items-center gap-2 text-muted-foreground text-sm"><Wallet className="w-4 h-4" /> Wallet balance</div><div className="text-4xl font-bold mt-3">GH₵{balance.toFixed(2)}</div></div>
        <div className="flex flex-wrap gap-3"><Button asChild><Link to="/dashboard/buy-data/$network" params={{ network: "mtn" }}><ShoppingBag /> Buy data</Link></Button><Button variant="outline" asChild><Link to="/dashboard/wallet" search={{ reference: undefined, trxref: undefined }}><Wallet /> Top up</Link></Button></div>
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={ShoppingBag} label="TOTAL SALES" value={`GH₵${(data?.totalSales ?? 0).toFixed(2)}`} />
        <StatCard icon={Receipt} label="TOTAL ORDERS" value={String(data?.totalOrders ?? 0)} />
        <StatCard icon={TrendingUp} label="DAILY SALES" value={`GH₵${(data?.daily ?? 0).toFixed(2)}`} />
        <StatCard icon={TrendingUp} label="WEEKLY SALES" value={`GH₵${(data?.weekly ?? 0).toFixed(2)}`} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg p-5 bg-card border border-border">
      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div className="text-xs tracking-widest text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
