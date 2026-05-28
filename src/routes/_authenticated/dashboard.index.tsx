import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ShoppingBag, Receipt, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:row-span-2 rounded-2xl p-6 bg-gradient-to-br from-[oklch(0.55_0.18_275)] to-[oklch(0.45_0.20_290)] text-white flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-4">
            <Wallet className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold">Welcome Back!</h2>
          <p className="text-white/80">{useAuth().user?.email}</p>
          <div className="mt-6 px-4 py-1.5 rounded-full bg-white/20 text-sm">Client</div>
          <div className="mt-6">
            <div className="text-sm opacity-80">Current Balance</div>
            <div className="text-4xl font-bold mt-1">GH₵{balance.toFixed(2)}</div>
          </div>
        </div>

        <StatCard icon={ShoppingBag} label="TOTAL SALES" value={`GH₵${(data?.totalSales ?? 0).toFixed(2)}`} tint="from-purple-500/20 to-purple-600/10" />
        <StatCard icon={Receipt} label="TOTAL ORDERS" value={String(data?.totalOrders ?? 0)} tint="from-emerald-500/20 to-emerald-600/10" />
        <StatCard icon={TrendingUp} label="DAILY SALES" value={`GH₵${(data?.daily ?? 0).toFixed(2)}`} tint="from-sky-500/20 to-sky-600/10" />
        <StatCard icon={TrendingUp} label="WEEKLY SALES" value={`GH₵${(data?.weekly ?? 0).toFixed(2)}`} tint="from-rose-500/20 to-rose-600/10" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: string; tint: string }) {
  return (
    <div className={`rounded-2xl p-6 bg-gradient-to-br ${tint} border border-border/40`}>
      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div className="text-xs tracking-widest text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
