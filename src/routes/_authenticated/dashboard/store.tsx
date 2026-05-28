import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Store as StoreIcon, ExternalLink, Copy, Check, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/store")({ component: StoreLayout });

const NETWORK_LABELS: Record<string, string> = {
  mtn: "MTN",
  airteltigo_ishare: "AT iShare",
  airteltigo_bigtime: "AT BigTime",
  telecel: "Telecel",
};

const cedis = (n: number | string) => `₵${Number(n).toFixed(2)}`;

export function useMyStore() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-store", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });
}

function StoreLayout() {
  const { data: store, isLoading } = useMyStore();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <StoreIcon className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">My Store</h1>
          <p className="text-muted-foreground">Run your own data reselling storefront under DataKing.</p>
        </div>
      </div>

      {!store && !isLoading && <CreateStoreCard />}
      {store && <Outlet />}
    </div>
  );
}

/* ─── Create store (no store yet) ─── */
function CreateStoreCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", slug: "", support_phone: "", support_whatsapp: "" });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stores").insert({ ...form, user_id: user!.id, active: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Store created"); qc.invalidateQueries({ queryKey: ["my-store"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h2 className="font-bold text-lg">Create your store</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label>Store name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>URL slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase() })} placeholder="kingsdata" /></div>
        <div><Label>Support phone</Label><Input value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} placeholder="0241234567" /></div>
        <div>
          <Label>WhatsApp channel / group link <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input value={form.support_whatsapp} onChange={(e) => setForm({ ...form, support_whatsapp: e.target.value })} placeholder="https://whatsapp.com/channel/..." />
        </div>
      </div>
      <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.slug || !form.support_phone}>
        {create.isPending ? "Creating..." : "Create store"}
      </Button>
    </div>
  );
}

/* ─── Share card ─── */
export function StoreShareCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/s/${slug}` : `/s/${slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Store link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Could not copy"); }
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="text-xs font-semibold text-muted-foreground">YOUR STORE LINK · share with customers</div>
      <div className="flex items-center gap-2">
        <Input readOnly value={url} className="font-mono text-xs bg-muted" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" size="sm" variant="outline" onClick={copy} className="shrink-0">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <Button type="button" size="sm" variant="outline"><ExternalLink className="w-4 h-4" /></Button>
        </a>
      </div>
    </div>
  );
}

/* ─── Overview stats ─── */
export function StoreOverview({ storeId }: { storeId: string }) {
  const { data } = useQuery({
    queryKey: ["store-overview", storeId],
    queryFn: async () => {
      const { data: txs } = await supabase
        .from("transactions")
        .select("amount,status,created_at,metadata")
        .filter("metadata->>store_id", "eq", storeId);
      const list = txs ?? [];
      const completed = list.filter((t: any) => t.status === "completed");
      const revenue = completed.reduce((s: number, t: any) => s + Number(t.amount), 0);
      return { count: list.length, completed: completed.length, revenue };
    },
  });
  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Orders" value={data?.count ?? 0} />
      <Stat label="Completed" value={data?.completed ?? 0} />
      <Stat label="Revenue" value={cedis(data?.revenue ?? 0)} />
    </div>
  );
}
function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

/* ─── Settings ─── */
export function StoreSettings({ store }: { store: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: store.name, slug: store.slug, support_phone: store.support_phone,
    support_whatsapp: store.support_whatsapp ?? "", active: store.active,
  });
  useEffect(() => {
    setForm({
      name: store.name, slug: store.slug, support_phone: store.support_phone,
      support_whatsapp: store.support_whatsapp ?? "", active: store.active,
    });
  }, [store]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stores").update(form).eq("id", store.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["my-store"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label>Store name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <Label>URL slug</Label>
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase() })} />
        </div>
        <div><Label>Support phone</Label><Input value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} /></div>
        <div>
          <Label>WhatsApp channel / group link</Label>
          <Input value={form.support_whatsapp} onChange={(e) => setForm({ ...form, support_whatsapp: e.target.value })} placeholder="https://whatsapp.com/channel/..." />
          <p className="text-[11px] text-muted-foreground mt-1">Shown as a floating button on your store.</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <div className="font-semibold">Storefront active</div>
          <div className="text-xs text-muted-foreground">Customers can find and order from your store.</div>
        </div>
        <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}

/* ─── Transactions ─── */
export function StoreTransactions({ storeId }: { storeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["store-transactions", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id,amount,status,network,recipient_phone,description,created_at,metadata")
        .filter("metadata->>store_id", "eq", storeId)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data?.length) return <div className="text-sm text-muted-foreground">No store orders yet.</div>;
  return (
    <div className="divide-y divide-border">
      {data.map((t: any) => (
        <div key={t.id} className="flex items-center justify-between py-3 text-sm">
          <div>
            <div className="font-medium">{t.description ?? "Order"}</div>
            <div className="text-xs text-muted-foreground">
              {t.recipient_phone ?? "—"} · {new Date(t.created_at).toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{cedis(t.amount)}</div>
            <Badge variant={t.status === "completed" ? "default" : t.status === "failed" ? "destructive" : "secondary"}>
              {t.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Subagent manager ─── */
export function SubagentManager({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const { data: list } = useQuery({
    queryKey: ["subagents", storeId],
    queryFn: async () => (await supabase.from("subagents").select("*").eq("store_id", storeId).order("created_at", { ascending: false })).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subagents").insert({ ...form, store_id: storeId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subagent added"); setForm({ name: "", phone: "", notes: "" }); qc.invalidateQueries({ queryKey: ["subagents", storeId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("subagents").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subagents", storeId] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subagents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["subagents", storeId] }); },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">ADD A SUBAGENT</div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending || !form.name || !form.phone}>
          <Plus className="w-4 h-4 mr-1" /> Add subagent
        </Button>
      </div>

      {!list?.length ? (
        <div className="text-sm text-muted-foreground">No subagents yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {list.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between py-3 text-sm gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground truncate">{s.phone}{s.notes ? ` · ${s.notes}` : ""}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch checked={s.active} onCheckedChange={(v) => toggle.mutate({ id: s.id, active: v })} />
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Withdrawals ─── */
export function Withdrawals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ amount: "", bank: "", account: "", name: "", note: "" });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: list } = useQuery({
    queryKey: ["my-withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("withdrawals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const submit = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(form.amount);
      if (!amount || amount <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase.rpc("request_withdrawal", {
        _user_id: user!.id,
        _amount: amount,
        _bank: form.bank,
        _account: form.account,
        _name: form.name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Withdrawal requested");
      setForm({ amount: "", bank: "", account: "", name: "", note: "" });
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-3">
        <div className="text-xs text-muted-foreground">Wallet balance</div>
        <div className="text-2xl font-bold">{cedis(wallet?.balance ?? 0)}</div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Amount (₵)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div><Label>Bank / Momo</Label><Input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="MTN Mobile Money" /></div>
        <div><Label>Account / Phone number</Label><Input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} /></div>
        <div><Label>Account name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Note (optional)</Label><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
      </div>
      <Button onClick={() => submit.mutate()} disabled={submit.isPending || !form.amount || !form.bank || !form.account || !form.name}>
        {submit.isPending ? "Requesting..." : "Request withdrawal"}
      </Button>

      <div className="border-t border-border pt-3">
        <div className="text-xs font-semibold text-muted-foreground mb-2">RECENT REQUESTS</div>
        {!list?.length ? (
          <div className="text-sm text-muted-foreground">No withdrawals yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {list.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{cedis(w.amount)} · {w.bank_name}</div>
                  <div className="text-xs text-muted-foreground">{w.account_name} · {w.account_number} · {new Date(w.created_at).toLocaleDateString()}</div>
                </div>
                <Badge variant={w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>{w.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Custom pricing (packages) ─── */
export function CustomPricing({ storeId }: { storeId: string }) {
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
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Set your selling price per bundle. The difference between agent price and your price is your profit. Leave blank to use the default price.
      </p>
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
                    <div className="text-xs text-muted-foreground">Agent: {cedis(p.agent_price)} · Default: {cedis(p.price)}</div>
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
