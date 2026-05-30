import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet as WalletIcon, Plus, SearchCheck, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { verifyPaystackTopup } from "@/lib/paystack.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PaystackMomoDialog } from "@/components/paystack-momo-dialog";
import { addPaystackFee } from "@/lib/paystack-fees";

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
  const verify = useServerFn(verifyPaystackTopup);

  const [amount, setAmount] = useState("50");
  const [topupOpen, setTopupOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [recoverRef, setRecoverRef] = useState("");
  const [recoverOpen, setRecoverOpen] = useState(false);

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

  const recoverMut = useMutation({
    mutationFn: async () => verify({ data: { reference: recoverRef.trim() } }),
    onSuccess: (r) => {
      if (r.credited) toast.success(`Wallet credited with GH₵${r.amount?.toFixed(2)}`);
      else if (r.status === "success") toast.info("Payment was already credited to your wallet.");
      else toast.info(`Payment not completed (status: ${r.status}).`);
      setRecoverRef(""); setRecoverOpen(false);
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet-history"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Legacy callback support (?reference=...)
  useEffect(() => {
    const ref = search.reference ?? search.trxref;
    if (!ref) return;
    verify({ data: { reference: ref } })
      .then((r) => {
        if (r.credited) toast.success(`Wallet credited with GH₵${r.amount?.toFixed(2)}`);
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["wallet-history"] });
        window.history.replaceState({}, "", "/dashboard/wallet");
      })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amountNum = Number(amount) || 0;
  const fees = amountNum > 0 ? addPaystackFee(amountNum) : null;

  const statusIcon = (s: string) => {
    if (s === "completed") return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (s === "failed" || s === "refunded") return <XCircle className="w-5 h-5 text-destructive" />;
    return <Clock className="w-5 h-5 text-amber-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 bg-gradient-to-br from-primary/30 to-amber-700/20 border border-primary/20">
        <div className="flex items-center gap-3 text-sm opacity-80"><WalletIcon className="w-4 h-4" /> WALLET BALANCE</div>
        <div className="text-5xl font-extrabold mt-2">GH₵{(wallet ?? 0).toFixed(2)}</div>
        <div className="flex flex-wrap gap-3 mt-6">
          <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2"><Plus className="w-4 h-4" /> Top up wallet</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Top up wallet</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Label>Amount (GH₵)</Label>
                <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <div className="flex gap-2 flex-wrap">
                  {[20, 50, 100, 200, 500].map((v) => (
                    <Button key={v} variant="outline" size="sm" onClick={() => setAmount(String(v))}>GH₵{v}</Button>
                  ))}
                </div>
                {fees && (
                  <div className="rounded-md bg-muted p-2 text-xs space-y-1">
                    <div className="flex justify-between"><span>Top-up amount</span><span>GH₵{fees.net.toFixed(2)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Paystack fee</span><span>GH₵{fees.fee.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold border-t border-border pt-1"><span>You pay</span><span>GH₵{fees.gross.toFixed(2)}</span></div>
                  </div>
                )}
                <Button className="w-full" disabled={amountNum < 1} onClick={() => { setTopupOpen(false); setPayOpen(true); }}>
                  Continue to MoMo payment
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={recoverOpen} onOpenChange={setRecoverOpen}>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline" className="gap-2"><SearchCheck className="w-4 h-4" /> Top-up not reflected?</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Recover a Paystack top-up</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Paid but wallet didn't update? Paste your Paystack reference and we'll verify.</p>
                <Label>Paystack reference</Label>
                <Input placeholder="e.g. DK-1716901234-AB12CD" value={recoverRef} onChange={(e) => setRecoverRef(e.target.value)} />
                <Button className="w-full" disabled={recoverMut.isPending || recoverRef.trim().length < 4} onClick={() => recoverMut.mutate()}>
                  {recoverMut.isPending ? "Checking…" : "Verify & credit wallet"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <PaystackMomoDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        totalDisplay={fees ? { net: fees.net, fee: fees.fee, gross: fees.gross } : null}
        defaults={{ email: user?.email ?? undefined }}
        buildPayload={() => {
          if (!user || amountNum < 1) return null;
          return { kind: "wallet_topup", amount: amountNum, user_id: user.id, email: user.email ?? "" };
        }}
        onSuccess={() => {
          toast.success("Wallet topped up successfully!");
          qc.invalidateQueries({ queryKey: ["wallet"] });
          qc.invalidateQueries({ queryKey: ["wallet-history"] });
          qc.invalidateQueries({ queryKey: ["overview"] });
        }}
        title="Top up via Mobile Money"
      />

      <div>
        <h2 className="text-xl font-bold mb-3">Recent wallet activity</h2>
        <div className="rounded-xl border border-border divide-y divide-border bg-card">
          {history?.length === 0 && <div className="p-6 text-sm text-muted-foreground">No activity yet.</div>}
          {history?.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {statusIcon(t.status as string)}
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
