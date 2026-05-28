import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet as WalletIcon, Plus, ArrowDownToLine, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { initPaystackTopup, verifyPaystackTopup } from "@/lib/paystack.functions";
import { requestWithdrawal } from "@/lib/purchase.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/wallet")({
  component: WalletPage,
  validateSearch: (s: Record<string, unknown>) => ({
    reference: typeof s.reference === "string" ? s.reference : undefined,
    trxref: typeof s.trxref === "string" ? s.trxref : undefined,
  }),
});

function WalletPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/dashboard/wallet" });
  const init = useServerFn(initPaystackTopup);
  const verify = useServerFn(verifyPaystackTopup);
  const withdraw = useServerFn(requestWithdrawal);

  const [amount, setAmount] = useState("50");
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  const { data: history } = useQuery({
    queryKey: ["wallet-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("*")
        .eq("user_id", user!.id).in("type", ["wallet_topup", "withdrawal", "refund"])
        .order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const topupMut = useMutation({
    mutationFn: async () => init({ data: { amount: Number(amount) } }),
    onSuccess: (res) => { window.location.href = res.authorization_url; },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    const ref = search.reference ?? search.trxref;
    if (!ref) return;
    verify({ data: { reference: ref } })
      .then((r) => {
        if (r.credited) toast.success(`Wallet credited with GH₵${r.amount?.toFixed(2)}`);
        else toast.info("Top-up not completed.");
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["wallet-history"] });
        qc.invalidateQueries({ queryKey: ["overview"] });
        window.history.replaceState({}, "", "/dashboard/wallet");
      })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 bg-gradient-to-br from-primary/30 to-amber-700/20 border border-primary/20">
        <div className="flex items-center gap-3 text-sm opacity-80"><WalletIcon className="w-4 h-4" /> WALLET BALANCE</div>
        <div className="text-5xl font-extrabold mt-2">GH₵{(wallet ?? 0).toFixed(2)}</div>
        <div className="flex flex-wrap gap-3 mt-6">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2"><Plus className="w-4 h-4" /> Top up wallet</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Top up via Paystack</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Label>Amount (GH₵)</Label>
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div className="flex gap-2 flex-wrap">
                  {[20, 50, 100, 200, 500].map((v) => (
                    <Button key={v} variant="outline" size="sm" onClick={() => setAmount(String(v))}>GH₵{v}</Button>
                  ))}
                </div>
                <Button className="w-full" disabled={topupMut.isPending} onClick={() => topupMut.mutate()}>
                  {topupMut.isPending ? "Redirecting..." : "Proceed to Paystack"}
                </Button>
                <p className="text-xs text-muted-foreground">Supports Mobile Money (MTN, AT, Telecel) and Cards.</p>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline" className="gap-2"><ArrowDownToLine className="w-4 h-4" /> Request withdrawal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Withdraw funds</DialogTitle></DialogHeader>
              <WithdrawForm onDone={() => {
                setWithdrawOpen(false);
                qc.invalidateQueries({ queryKey: ["wallet"] });
                qc.invalidateQueries({ queryKey: ["wallet-history"] });
              }} withdraw={withdraw} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-3">Recent wallet activity</h2>
        <div className="rounded-xl border border-border divide-y divide-border bg-card">
          {history?.length === 0 && <div className="p-6 text-sm text-muted-foreground">No activity yet.</div>}
          {history?.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {t.status === "completed"
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  : <Clock className="w-5 h-5 text-amber-500" />}
                <div>
                  <div className="font-semibold capitalize">{t.type.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.description}</div>
                </div>
              </div>
              <div className={`font-bold ${t.type === "withdrawal" ? "text-destructive" : "text-emerald-500"}`}>
                {t.type === "withdrawal" ? "-" : "+"}GH₵{Number(t.amount).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WithdrawForm({ withdraw, onDone }: { withdraw: any; onDone: () => void }) {
  const [form, setForm] = useState({ amount: "50", bank: "", account: "", name: "" });
  const mut = useMutation({
    mutationFn: () => withdraw({ data: { amount: Number(form.amount), bank: form.bank, account: form.account, name: form.name } }),
    onSuccess: () => { toast.success("Withdrawal request submitted."); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div><Label>Bank / Wallet</Label><Input placeholder="MTN MoMo" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} /></div>
      </div>
      <div><Label>Account / Phone number</Label><Input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} /></div>
      <div><Label>Account name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <Button className="w-full" disabled={mut.isPending} onClick={() => mut.mutate()}>
        {mut.isPending ? "Submitting..." : "Submit request"}
      </Button>
    </div>
  );
}
