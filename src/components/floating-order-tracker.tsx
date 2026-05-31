import { useState } from "react";
import { Search, PackageSearch, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Order = {
  id: string;
  type: string;
  status: string;
  amount: number;
  network: string | null;
  size_label: string | null;
  description: string | null;
  recipient_phone: string;
  created_at: string;
  updated_at: string;
};

const statusMeta: Record<string, { label: string; color: string; Icon: any }> = {
  pending_payment: { label: "Awaiting payment", color: "text-amber-500 bg-amber-500/10", Icon: Clock },
  pending: { label: "Processing", color: "text-amber-500 bg-amber-500/10", Icon: Clock },
  completed: { label: "Delivered", color: "text-emerald-500 bg-emerald-500/10", Icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-500 bg-red-500/10", Icon: XCircle },
  refunded: { label: "Refunded", color: "text-blue-500 bg-blue-500/10", Icon: CheckCircle2 },
};

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function FloatingOrderTracker({ bottomClassName = "bottom-24" }: { bottomClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    const clean = phone.replace(/\D/g, "");
    if (!/^0\d{9}$/.test(clean)) return toast.error("Enter a valid 10-digit phone");
    setLoading(true); setSearched(true);
    try {
      const r = await fetch("/api/public/v1/track-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't fetch orders");
      setOrders(j.orders ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Network error");
      setOrders([]);
    } finally { setLoading(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Track an order"
        className={`fixed ${bottomClassName} right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform`}
      >
        <PackageSearch className="w-6 h-6" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setOrders(null); setSearched(false); setPhone(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Track your data order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Phone number used for the order</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="0241234567"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") search(); }}
                />
                <Button onClick={search} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">We'll show orders from the last 30 days.</p>
            </div>

            <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-2">
              {!searched && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Enter the recipient phone to see your recent orders.
                </div>
              )}
              {searched && !loading && (orders?.length ?? 0) === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  No recent orders found for this number.
                </div>
              )}
              {orders?.map((o) => {
                const meta = statusMeta[o.status] ?? { label: o.status, color: "text-muted-foreground bg-muted", Icon: Clock };
                const Icon = meta.Icon;
                return (
                  <div key={o.id} className="rounded-lg border border-border p-3 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {o.size_label ? `${o.size_label}${o.network ? " · " + o.network.toUpperCase().replace("_", " ") : ""}` : o.description ?? "Order"}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          GH₵{o.amount.toFixed(2)} · {relTime(o.created_at)}
                        </div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${meta.color}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
