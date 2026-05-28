import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { buyChecker } from "@/lib/purchase.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/checkers")({ component: Page });

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const buy = useServerFn(buyChecker);
  const [selected, setSelected] = useState<any>(null);
  const [phone, setPhone] = useState("");

  const { data } = useQuery({
    queryKey: ["checkers"],
    queryFn: async () => {
      const { data } = await supabase.from("result_checkers").select("*").eq("active", true);
      return data ?? [];
    },
  });

  const { data: owned } = useQuery({
    queryKey: ["owned-checkers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("description,amount,created_at,status,recipient_phone")
        .eq("user_id", user!.id).eq("type", "checker_purchase").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: () => buy({ data: { checkerId: selected.id, phone } }),
    onSuccess: () => {
      toast.success("Checker purchased.");
      setSelected(null); setPhone("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["owned-checkers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const phoneValid = /^0\d{9}$/.test(phone);

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Result Checkers</h1><p className="text-muted-foreground">Buy WAEC, BECE and other exam checkers instantly.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map((c) => (
          <button key={c.id} onClick={() => { setSelected(c); setPhone(""); }} className="text-left rounded-xl p-5 bg-card border border-border hover:border-primary/50 transition">
            <FileCheck className="w-8 h-8 text-primary mb-2" />
            <div className="font-bold text-lg">{c.name}</div>
            <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
            <div className="mt-3 text-2xl font-extrabold text-primary">GH₵{Number(c.price).toFixed(2)}</div>
          </button>
        ))}
      </div>

      {owned && owned.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-2">Your purchased checkers</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {owned.map((o, i) => (
              <div key={i} className="p-3 flex justify-between text-sm">
                <span>{o.description}{o.recipient_phone ? ` · ${o.recipient_phone}` : ""}</span>
                <span className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()} · {o.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setPhone(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buy {selected?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{selected?.description}</p>
          <div className="space-y-2">
            <Label>Recipient phone number</Label>
            <Input
              placeholder="0241234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
            />
            {phone && !phoneValid && (
              <p className="text-xs text-destructive">Enter a 10-digit number starting with 0.</p>
            )}
          </div>
          <div className="rounded-lg p-3 bg-muted text-sm flex justify-between"><span>Total</span><span className="font-bold">GH₵{Number(selected?.price ?? 0).toFixed(2)}</span></div>
          <Button className="w-full" disabled={mut.isPending || !phoneValid} onClick={() => mut.mutate()}>
            {mut.isPending ? "Processing..." : "Pay & purchase"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
