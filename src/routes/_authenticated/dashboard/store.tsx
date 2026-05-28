import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Store as StoreIcon, ExternalLink, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/store")({ component: StorePage });

const NETWORK_LABELS: Record<string, string> = {
  mtn: "MTN",
  airteltigo_ishare: "AT iShare",
  airteltigo_bigtime: "AT BigTime",
  telecel: "Telecel",
};

function StorePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", slug: "", support_phone: "", support_whatsapp: "", active: true });

  const { data: store } = useQuery({
    queryKey: ["my-store", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (store) setForm({
      name: store.name, slug: store.slug, support_phone: store.support_phone,
      support_whatsapp: store.support_whatsapp ?? "", active: store.active,
    });
  }, [store]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, user_id: user!.id };
      if (store) {
        const { error } = await supabase.from("stores").update(payload).eq("id", store.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Store saved"); qc.invalidateQueries({ queryKey: ["my-store"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <StoreIcon className="w-8 h-8 text-primary" />
        <div><h1 className="text-3xl font-bold">My Store</h1><p className="text-muted-foreground">Run your own data reselling storefront under DataKing.</p></div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Store name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>URL slug</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase() })} placeholder="kingsdata" />
          </div>
          <div><Label>Support phone</Label><Input value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} /></div>
          <div><Label>WhatsApp number</Label><Input value={form.support_whatsapp} onChange={(e) => setForm({ ...form, support_whatsapp: e.target.value })} /></div>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div><div className="font-semibold">Storefront active</div><div className="text-xs text-muted-foreground">Customers can find and order from your store.</div></div>
          <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.slug || !form.support_phone}>
          {save.isPending ? "Saving..." : store ? "Save changes" : "Create store"}
        </Button>
        {store && (
          <div className="rounded-lg bg-muted p-3 text-sm flex items-center justify-between">
            <span className="truncate">Your store URL: <span className="font-mono">/s/{store.slug}</span></span>
            <Link to="/s/$slug" params={{ slug: store.slug }} className="text-primary inline-flex items-center gap-1 text-xs"><ExternalLink className="w-3 h-3" />Open</Link>
          </div>
        )}
      </div>

      {store && <CustomPricing storeId={store.id} />}
    </div>
  );
}

function CustomPricing({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const { data: packages } = useQuery({
    queryKey: ["all-packages"],
    queryFn: async () => (await supabase.from("data_packages").select("*").eq("active", true).order("network").order("sort_order")).data ?? [],
  });
  const { data: overrides } = useQuery({
    queryKey: ["store-prices", storeId],
    queryFn: async () => (await supabase.from("store_package_prices").select("*").eq("store_id", storeId)).data ?? [],
  });
  const overrideMap = new Map((overrides ?? []).map((o: any) => [o.package_id, Number(o.price)]));
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const setPrice = useMutation({
    mutationFn: async ({ packageId, price }: { packageId: string; price: number | null }) => {
      if (price === null) {
        const { error } = await supabase.from("store_package_prices").delete().eq("store_id", storeId).eq("package_id", packageId);
        if (error) throw error;
      } else {
        const existing = (overrides ?? []).find((o: any) => o.package_id === packageId);
        if (existing) {
          const { error } = await supabase.from("store_package_prices").update({ price }).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("store_package_prices").insert({ store_id: storeId, package_id: packageId, price });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { toast.success("Price updated"); qc.invalidateQueries({ queryKey: ["store-prices", storeId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = (packages ?? []).reduce((acc: any, p: any) => {
    (acc[p.network] ||= []).push(p); return acc;
  }, {});

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2"><Tag className="w-5 h-5 text-primary" /><h2 className="font-bold text-lg">Custom Storefront Pricing</h2></div>
      <p className="text-xs text-muted-foreground">Set your selling price per bundle. The difference between agent price and your price is your profit. Leave blank to use the default price.</p>
      {Object.entries(grouped).map(([net, items]: any) => (
        <div key={net} className="space-y-2">
          <div className="font-semibold text-sm">{NETWORK_LABELS[net] ?? net}</div>
          <div className="divide-y divide-border">
            {items.map((p: any) => {
              const current = drafts[p.id] ?? (overrideMap.get(p.id)?.toString() ?? "");
              return (
                <div key={p.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="flex-1">
                    <div className="font-medium">{p.size_label}</div>
                    <div className="text-xs text-muted-foreground">Agent: ₵{Number(p.agent_price).toFixed(2)} · Default: ₵{Number(p.price).toFixed(2)}</div>
                  </div>
                  <Input
                    className="w-28"
                    placeholder={Number(p.price).toFixed(2)}
                    value={current}
                    onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                  />
                  <Button size="sm" variant="outline"
                    onClick={() => {
                      const v = parseFloat(current);
                      if (current === "" || isNaN(v)) setPrice.mutate({ packageId: p.id, price: null });
                      else setPrice.mutate({ packageId: p.id, price: v });
                    }}>Save</Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
