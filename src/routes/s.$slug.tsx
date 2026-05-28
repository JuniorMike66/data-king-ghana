import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Phone } from "lucide-react";

export const Route = createFileRoute("/s/$slug")({ component: PublicStore });

function PublicStore() {
  const { slug } = useParams({ from: "/s/$slug" });
  const { data: store, isLoading } = useQuery({
    queryKey: ["public-store", slug],
    queryFn: async () => (await supabase.from("stores").select("*").eq("slug", slug).eq("active", true).maybeSingle()).data,
  });
  const { data: packages } = useQuery({
    queryKey: ["public-store-packages"],
    queryFn: async () => (await supabase.from("data_packages").select("*").eq("active", true).order("network").order("sort_order")).data ?? [],
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!store) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Store not found</div>;

  const wa = store.support_whatsapp?.replace(/[^0-9]/g, "");
  const order = (p: any) => {
    const msg = `Hi ${store.name}, I want to buy ${p.size_label} ${p.network.toUpperCase()} data for GH₵${Number(p.price).toFixed(2)}`;
    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
    else window.location.href = `tel:${store.support_phone}`;
  };

  const networks: any = { mtn: { label: "MTN", color: "bg-mtn text-mtn-foreground" },
    airteltigo_ishare: { label: "AT iShare", color: "bg-airteltigo text-airteltigo-foreground" },
    airteltigo_bigtime: { label: "AT BigTime", color: "bg-airteltigo text-airteltigo-foreground" },
    telecel: { label: "Telecel", color: "bg-telecel text-telecel-foreground" }};

  return (
    <div className="min-h-screen bg-background adinkra-bg">
      <header className="bg-gradient-to-br from-primary/30 to-amber-700/20 border-b border-border p-8 text-center">
        <h1 className="text-4xl font-extrabold">{store.name}</h1>
        <p className="text-muted-foreground mt-2">Trusted data reseller · Powered by DataKing GH</p>
        <div className="flex justify-center gap-3 mt-4">
          {wa && <a href={`https://wa.me/${wa}`} target="_blank" className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg"><MessageCircle className="w-4 h-4" />WhatsApp</a>}
          <a href={`tel:${store.support_phone}`} className="inline-flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-lg"><Phone className="w-4 h-4" />{store.support_phone}</a>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {Object.entries(networks).map(([key, cfg]: any) => {
          const items = (packages ?? []).filter((p: any) => p.network === key);
          if (!items.length) return null;
          return (
            <section key={key}>
              <h2 className="text-xl font-bold mb-3">{cfg.label} Bundles</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {items.map((p: any) => (
                  <button key={p.id} onClick={() => order(p)} className={`${cfg.color} rounded-xl p-4 text-left shadow hover:scale-[1.02] transition`}>
                    <div className="text-2xl font-extrabold">{p.size_label}</div>
                    <div className="text-xl font-bold mt-2">₵{Number(p.price).toFixed(2)}</div>
                    <div className="text-[10px] opacity-80 mt-1">NO EXPIRY · Tap to order</div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </main>
      <footer className="text-center text-xs text-muted-foreground py-6">© {new Date().getFullYear()} {store.name} · Powered by DataKing Ghana</footer>
    </div>
  );
}
