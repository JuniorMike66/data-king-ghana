import { createFileRoute, Outlet, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Phone, Crown } from "lucide-react";
import { DataKingLoader, DataKingFullPageLoader } from "@/components/dataking-loader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { addPaystackFee } from "@/lib/paystack-fees";

type SearchParams = { reference?: string };

export const Route = createFileRoute("/s/$slug")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    reference: typeof s.reference === "string" ? s.reference : undefined,
  }),
  component: StoreLayout,
});

function StoreLayout() {
  return <Outlet />;
}

const networks: Record<string, { label: string; color: string }> = {
  mtn: { label: "MTN", color: "bg-mtn text-mtn-foreground" },
  airteltigo_ishare: { label: "AT iShare", color: "bg-airteltigo text-airteltigo-foreground" },
  airteltigo_bigtime: { label: "AT BigTime", color: "bg-airteltigo text-airteltigo-foreground" },
  telecel: { label: "Telecel", color: "bg-telecel text-telecel-foreground" },
};

export function PublicStore() {
  const { slug } = useParams({ from: "/s/$slug" });
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { data: store, isLoading } = useQuery({
    queryKey: ["public-store", slug],
    queryFn: async () =>
      (await supabase.from("stores").select("*").eq("slug", slug).eq("active", true).maybeSingle()).data,
  });

  const { data: packages } = useQuery({
    queryKey: ["public-store-packages", store?.id, store?.sponsor_id],
    enabled: !!store,
    queryFn: async () => {
      const [{ data: pkgs }, { data: overrides }, { data: sponsorPrices }] = await Promise.all([
        supabase.from("data_packages").select("*").eq("active", true).order("network").order("sort_order"),
        supabase.from("store_package_prices").select("package_id,price").eq("store_id", store!.id),
        store?.sponsor_id
          ? supabase.from("subagent_prices").select("package_id,price").eq("sponsor_id", store.sponsor_id)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const storeMap = new Map((overrides ?? []).map((o: any) => [o.package_id, Number(o.price)]));
      const sponsorMap = new Map((sponsorPrices ?? []).map((o: any) => [o.package_id, Number(o.price)]));
      return (pkgs ?? []).map((p: any) => {
        const base = sponsorMap.get(p.id) ?? Number(p.price);
        return { ...p, price: storeMap.get(p.id) ?? base };
      });
    },
  });


  // Handle Paystack callback
  useEffect(() => {
    const reference = search.reference;
    if (!reference || verifying) return;
    setVerifying(true);
    (async () => {
      try {
        const res = await fetch("/api/public/v1/store-order/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Verification failed");
        // Customers always see success — real status lives on the admin dashboard.
        toast.success("Payment confirmed — your data is on the way!");

      } catch (e: any) {
        toast.error(e.message ?? "Could not verify payment");
      } finally {
        navigate({ to: "/s/$slug", params: { slug }, search: {}, replace: true });
        setVerifying(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.reference]);

  if (isLoading) {
    return <DataKingFullPageLoader />;
  }
  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center p-6">
        <h1 className="text-2xl font-bold">Store not found</h1>
        <p className="text-muted-foreground">This storefront is unavailable or inactive.</p>
        <button
          onClick={() => window.location.reload()}
          className="text-primary underline"
        >
          Reload
        </button>
      </div>
    );
  }

  const waLink = (store.support_whatsapp ?? "").trim();

  const startPurchase = async () => {
    if (!selected) return;
    if (!/^0\d{9}$/.test(phone)) return toast.error("Enter a valid 10-digit phone");
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email for receipt");
    setPaying(true);
    try {
      const res = await fetch("/api/public/v1/store-order/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_slug: slug,
          package_id: selected.id,
          recipient_phone: phone,
          customer_email: email,
          origin: window.location.origin,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start payment");
      window.location.href = json.authorization_url;
    } catch (e: any) {
      toast.error(e.message);
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background adinkra-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold leading-tight">{store.name}</div>
              <div className="text-[10px] text-muted-foreground">Instant data bundles</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link to="/s/$slug/become-agent" params={{ slug }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90">
              <Crown className="w-4 h-4" /> Become an Agent
            </Link>
            <a href={`tel:${store.support_phone}`} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border">
              <Phone className="w-4 h-4" />{store.support_phone}
            </a>
          </div>

        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/20 to-amber-700/10 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold">Buy Data, Instantly</h1>
          <p className="text-muted-foreground mt-2">Affordable MTN, AirtelTigo & Telecel bundles with no expiry. Pay securely via mobile money or card.</p>
        </div>
      </section>

      {/* Bundles */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 flex-1 w-full">
        <NetworkSwitcher packages={packages ?? []} setSelected={setSelected} setPhone={setPhone} setEmail={setEmail} />
        {(packages?.length ?? 0) === 0 && (
          <div className="text-center text-muted-foreground py-12">No bundles available yet.</div>
        )}
      </main>


      <footer className="text-center text-xs text-muted-foreground py-6 border-t border-border mt-6">
        © {new Date().getFullYear()} {store.name}
      </footer>

      {/* Floating WhatsApp */}
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Join our WhatsApp"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <MessageCircle className="w-7 h-7" fill="white" />
        </a>
      )}

      {/* Order modal */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o && !paying) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy {selected?.size_label} {selected ? networks[selected.network]?.label : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const price = Number(selected?.price ?? 0);
              const { gross, fee } = price > 0 ? addPaystackFee(price) : { gross: 0, fee: 0 };
              return (
                <div className="rounded-lg p-3 bg-muted text-sm space-y-1">
                  <div className="flex justify-between"><span>Bundle</span><span>GH₵{price.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Paystack fee</span><span>GH₵{fee.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total to pay</span><span>GH₵{gross.toFixed(2)}</span></div>
                </div>
              );
            })()}
            <div>
              <Label>Recipient phone number</Label>
              <Input placeholder="0241234567" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} />
            </div>
            <div>
              <Label>Your email (for payment receipt)</Label>
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button className="w-full" disabled={paying} onClick={startPurchase}>
              {paying ? "Redirecting to payment..." : "Pay & Order"}
            </Button>
            <p className="text-[11px] text-muted-foreground">You'll be redirected to a secure Paystack page (Mobile Money or Card). Data is sent automatically after payment.</p>
          </div>
        </DialogContent>
      </Dialog>

      {verifying && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center">
          <DataKingLoader label="Verifying your payment..." size={64} />
        </div>
      )}
    </div>
  );
}

function NetworkSwitcher({ packages, setSelected, setPhone, setEmail }: { packages: any[]; setSelected: (p: any) => void; setPhone: (s: string) => void; setEmail: (s: string) => void }) {
  const available = Object.keys(networks).filter((k) => packages.some((p) => p.network === k));
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (available.length && (!active || !available.includes(active))) setActive(available[0]);
  }, [available.join("|")]);
  if (!available.length) return null;
  const items = packages.filter((p) => p.network === active);
  const cfg = active ? networks[active] : null;
  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-background/95 backdrop-blur border-b border-border sm:border-0 sm:bg-transparent sm:backdrop-blur-0">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {available.map((k) => (
            <button
              key={k}
              onClick={() => setActive(k)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition ${
                active === k ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {networks[k].label}
            </button>
          ))}
        </div>
      </div>
      {cfg && (
        <section>
          <h2 className="text-xl font-bold mb-3">{cfg.label} Bundles</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((p: any) => (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setPhone(""); setEmail(""); }}
                className={`${cfg.color} rounded-xl p-4 text-left shadow hover:scale-[1.02] transition`}
              >
                <div className="text-2xl font-extrabold">{p.size_label}</div>
                <div className="text-xl font-bold mt-2">₵{Number(p.price).toFixed(2)}</div>
                <div className="text-[10px] opacity-80 mt-1">NO EXPIRY · Tap to buy</div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

