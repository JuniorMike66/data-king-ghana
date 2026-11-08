import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Crown, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaystackMomoDialog } from "@/components/paystack-momo-dialog";
import { FloatingOrderTracker } from "@/components/floating-order-tracker";
import { addPaystackFee } from "@/lib/paystack-fees";
import { toast } from "sonner";

const packagesQuery = queryOptions({
  queryKey: ["guest-data-packages"],
  queryFn: async () => {
    const { data, error } = await supabase.from("data_packages")
      .select("id,network,size_label,price,size_mb").eq("active", true).order("size_mb");
    if (error) throw new Error("Could not load bundles. Please try again.");
    return data ?? [];
  },
});

const networks = [
  { key: "mtn", label: "MTN", color: "bg-mtn text-mtn-foreground" },
  { key: "airteltigo_ishare", label: "AT iShare", color: "bg-airteltigo text-airteltigo-foreground" },
  { key: "airteltigo_bigtime", label: "AT BigTime", color: "bg-airteltigo text-airteltigo-foreground" },
  { key: "telecel", label: "Telecel", color: "bg-telecel text-telecel-foreground" },
];

export const Route = createFileRoute("/buy-data")({
  head: () => ({ meta: [
    { title: "Guest Data Bundles — DataKing Ghana" },
    { name: "description", content: "Buy MTN, AirtelTigo and Telecel data without an account. Pay with mobile money and track your order." },
    { property: "og:title", content: "Guest Data Bundles — DataKing Ghana" },
    { property: "og:description", content: "Buy data as a guest and track your order by recipient phone." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(packagesQuery),
  component: GuestDataPage,
});

function GuestDataPage() {
  const { data: packages } = useSuspenseQuery(packagesQuery);
  const [network, setNetwork] = useState("mtn");
  const [selected, setSelected] = useState<(typeof packages)[number] | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ reference: string; phone: string } | null>(null);
  const config = networks.find((item) => item.key === network) ?? networks[0];
  const totals = selected ? { net: Number(selected.price), ...addPaystackFee(Number(selected.price)) } : null;
  const startPayment = () => {
    if (!/^0\d{9}$/.test(phone)) return toast.error("Enter a valid 10-digit recipient number");
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email for your receipt");
    setPayOpen(true);
  };

  return <div className="min-h-screen bg-background adinkra-bg">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold"><Crown className="text-primary w-6 h-6" /> DataKing Ghana</div>
        <div className="flex items-center gap-2"><FloatingOrderTracker inline /><Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button></div>
      </div>
    </header>
    <main className="relative mx-auto max-w-6xl px-4 py-8 pb-28">
      <Button asChild variant="link" className="px-0 mb-5"><Link to="/login"><ArrowLeft className="w-4 h-4" /> Back to sign in</Link></Button>
      <h1 className="text-3xl font-bold">Buy data as a guest</h1>
      <div className="sticky top-20 z-10 flex gap-2 overflow-x-auto py-5 bg-background/95" role="tablist" aria-label="Data networks">
        {networks.map((item) => <Button key={item.key} role="tab" aria-selected={network === item.key} variant={network === item.key ? "default" : "outline"} className="shrink-0" onClick={() => setNetwork(item.key)}>{item.label}</Button>)}
      </div>
      {receipt && <section className="border-l-2 border-success py-3 px-4 mb-6 space-y-1" aria-live="polite">
        <div className="flex items-center gap-2 text-success font-semibold"><CheckCircle2 className="w-5 h-5" /> Payment confirmed</div>
        <p className="text-sm">Recipient: {receipt.phone}</p><p className="text-xs text-muted-foreground break-all">Reference: {receipt.reference}</p>
      </section>}
      <h2 className="text-xl font-semibold mb-4">{config.label} bundles</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {packages.filter((item) => item.network === network).map((item) => <Button key={item.id} variant="ghost" className={`${config.color} h-auto min-h-32 rounded-lg p-5 flex flex-col items-start gap-2 hover:opacity-90`} onClick={() => { setSelected(item); setPhone(""); setEmail(""); }}>
          <span className="text-2xl font-bold">{item.size_label}</span><span className="text-xl font-semibold">GH₵{Number(item.price).toFixed(2)}</span>
        </Button>)}
      </div>
      {!packages.some((item) => item.network === network) && <p className="text-muted-foreground py-8">No bundles available for this network.</p>}
    </main>
    <Dialog open={!!selected && !payOpen} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Buy {selected?.size_label} {config.label}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {totals && <div className="bg-muted rounded-lg p-3 space-y-2 text-sm"><div className="flex justify-between"><span>Bundle</span><span>GH₵{totals.net.toFixed(2)}</span></div><div className="flex justify-between text-muted-foreground"><span>Paystack fee</span><span>GH₵{totals.fee.toFixed(2)}</span></div><div className="flex justify-between font-bold border-t border-border pt-2"><span>Total</span><span>GH₵{totals.gross.toFixed(2)}</span></div></div>}
          <div className="space-y-2"><Label htmlFor="guest-recipient">Recipient phone number</Label><Input id="guest-recipient" inputMode="numeric" maxLength={10} placeholder="0241234567" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} /></div>
          <div className="space-y-2"><Label htmlFor="guest-email">Email for receipt</Label><Input id="guest-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Button className="w-full" onClick={startPayment}>Continue to payment</Button>
        </div>
      </DialogContent>
    </Dialog>
    {selected && <PaystackMomoDialog open={payOpen} onOpenChange={setPayOpen} totalDisplay={totals} defaults={{ phone, email }}
      buildPayload={() => ({ kind: "guest_order", package_id: selected.id, recipient_phone: phone, customer_email: email })}
      onSuccess={({ reference }) => { setReceipt({ reference, phone }); setSelected(null); setPayOpen(false); toast.success("Payment confirmed — your order has been received"); }} />}
  </div>;
}