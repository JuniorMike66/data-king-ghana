import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { buyData } from "@/lib/purchase.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Wallet, CreditCard } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PaystackMomoDialog } from "@/components/paystack-momo-dialog";
import { addPaystackFee } from "@/lib/paystack-fees";

const map: Record<string, { network: "mtn" | "airteltigo_ishare" | "airteltigo_bigtime" | "telecel"; label: string; color: string }> = {
  mtn: { network: "mtn", label: "MTN", color: "bg-mtn text-mtn-foreground" },
  "at-ishare": { network: "airteltigo_ishare", label: "AirtelTigo iShare", color: "bg-airteltigo text-airteltigo-foreground" },
  "at-bigtime": { network: "airteltigo_bigtime", label: "AirtelTigo BigTime", color: "bg-airteltigo text-airteltigo-foreground" },
  telecel: { network: "telecel", label: "Telecel", color: "bg-telecel text-telecel-foreground" },
};

export const Route = createFileRoute("/_authenticated/dashboard/buy-data/$network")({ component: Page });

function Page() {
  const { network } = useParams({ from: "/_authenticated/dashboard/buy-data/$network" });
  const cfg = map[network];
  const qc = useQueryClient();
  const buy = useServerFn(buyData);
  const [selected, setSelected] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paystack">("wallet");
  const [payOpen, setPayOpen] = useState(false);
  const { user } = useAuth();

  const { data: pkgs } = useQuery({
    queryKey: ["packages", cfg?.network],
    enabled: !!cfg,
    queryFn: async () => {
      const { data } = await supabase
        .from("data_packages").select("*").eq("network", cfg.network).eq("active", true).order("sort_order");
      const list = data ?? [];
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return list;
      const { data: prof } = await supabase
        .from("profiles").select("sponsor_id,store_activated_at").eq("id", me.user.id).maybeSingle();
      if (prof?.sponsor_id) {
        const { data: sp } = await supabase.from("subagent_prices").select("package_id,price").eq("sponsor_id", prof.sponsor_id);
        const map = new Map((sp ?? []).map((o: any) => [o.package_id, Number(o.price)]));
        return list.map((p: any) => ({ ...p, price: map.get(p.id) ?? Number(p.agent_price ?? p.price) }));
      }
      if (prof?.store_activated_at) {
        return list.map((p: any) => ({ ...p, price: Number(p.agent_price ?? p.price) }));
      }
      return list;
    },
  });


  const mut = useMutation({
    mutationFn: () => buy({ data: { packageId: selected.id, phone } }),
    onSuccess: () => {
      toast.success(`${selected.size_label} order placed for ${phone}`);
      setSelected(null); setPhone("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!cfg) return <div>Unknown network</div>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Buy {cfg.label} Data</h1>
        <p className="text-muted-foreground">All bundles have no expiry. Tap a package to purchase.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {pkgs?.map((p) => (
          <Button variant="ghost" key={p.id} onClick={() => setSelected(p)} className={`bundle-tile ${cfg.color} h-auto rounded-lg p-5 flex flex-col items-stretch text-left`}>
            <div className="text-xs font-semibold opacity-80">{cfg.label.toUpperCase()}</div>
            <div className="text-3xl font-extrabold mt-1">{p.size_label}</div>
            <div className="flex items-end justify-between mt-4">
              <div className="text-2xl font-bold">₵{Number(p.price).toFixed(2)}</div>
              <div className="text-[10px] font-semibold opacity-80">NO EXPIRY</div>
            </div>
          </Button>
        ))}
      </div>

      <Dialog open={!!selected && !payOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buy {selected?.size_label} {cfg.label}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div role="tablist" aria-label="Payment method" className="grid grid-cols-2 gap-2">
              <Button role="tab" aria-selected={paymentMethod === "wallet"} variant={paymentMethod === "wallet" ? "default" : "outline"} onClick={() => setPaymentMethod("wallet")}><Wallet /> Wallet</Button>
              <Button role="tab" aria-selected={paymentMethod === "paystack"} variant={paymentMethod === "paystack" ? "default" : "outline"} onClick={() => setPaymentMethod("paystack")}><CreditCard /> Paystack</Button>
            </div>
            <div className="rounded-lg p-3 bg-muted text-sm flex justify-between">
              <span>{paymentMethod === "wallet" ? "Wallet debit" : "Total including Paystack fee"}</span>
              <span className="font-bold">GH₵{(paymentMethod === "wallet" ? Number(selected?.price ?? 0) : addPaystackFee(Number(selected?.price ?? 0)).gross).toFixed(2)}</span>
            </div>
            <Label htmlFor="dashboard-recipient">Recipient phone number</Label>
            <Input id="dashboard-recipient" inputMode="numeric" placeholder="0241234567" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={10} />
            <Button className="w-full" disabled={mut.isPending || !/^0\d{9}$/.test(phone)} onClick={() => paymentMethod === "wallet" ? mut.mutate() : setPayOpen(true)}>
              {mut.isPending ? "Processing..." : paymentMethod === "wallet" ? "Buy from wallet" : "Continue to Paystack"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {selected && <PaystackMomoDialog open={payOpen} onOpenChange={setPayOpen}
        defaults={{ phone, email: user?.email }}
        totalDisplay={{ net: Number(selected.price), ...addPaystackFee(Number(selected.price)) }}
        buildPayload={() => ({ kind: "dashboard_order", package_id: selected.id, recipient_phone: phone, customer_email: user?.email ?? "" })}
        onSuccess={() => {
          toast.success(`${selected.size_label} order placed for ${phone}`);
          setSelected(null); setPayOpen(false); setPhone("");
          qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["overview"] });
        }} />}
    </div>
  );
}
