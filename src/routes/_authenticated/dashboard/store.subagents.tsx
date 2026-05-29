import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import * as profileMod from "@/lib/use-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/store/subagents")({ component: Page });

const NETWORK_LABELS: Record<string, string> = {
  mtn: "MTN", airteltigo_ishare: "AT iShare", airteltigo_bigtime: "AT BigTime", telecel: "Telecel",
};
const cedis = (n: number | string) => `₵${Number(n).toFixed(2)}`;

function Page() {
  const { user } = useAuth();
  const { isSubagent, isLoading } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isSubagent) navigate({ to: "/dashboard/store" });
  }, [isSubagent, isLoading, navigate]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (isSubagent) return null;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <SubagentList sponsorId={user.id} />
      <ActivationMarkup sponsorId={user.id} />
      <SubagentPricing sponsorId={user.id} />
    </div>
  );
}

function ActivationMarkup({ sponsorId }: { sponsorId: string }) {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["site-settings-sub-act"],
    queryFn: async () => (await supabase.from("site_settings").select("subagent_activation_enabled,subagent_activation_base_fee").eq("id", 1).maybeSingle()).data,
  });
  const { data: row } = useQuery({
    queryKey: ["my-sub-act-markup", sponsorId],
    queryFn: async () => (await supabase.from("subagent_activation_markup").select("markup").eq("sponsor_id", sponsorId).maybeSingle()).data,
  });
  const [val, setVal] = useState<string>("");
  useEffect(() => { if (row) setVal(String(row.markup ?? "")); }, [row]);

  const save = useMutation({
    mutationFn: async () => {
      const m = Number(val) || 0;
      const { error } = await supabase.from("subagent_activation_markup").upsert(
        { sponsor_id: sponsorId, markup: m }, { onConflict: "sponsor_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["my-sub-act-markup", sponsorId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!settings?.subagent_activation_enabled) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-bold text-lg mb-1">Subagent activation</h2>
        <p className="text-sm text-muted-foreground">Subagent activation is currently <strong>free</strong> (turned off by admin). When enabled, you'll be able to add your own markup here.</p>
      </div>
    );
  }
  const base = Number(settings.subagent_activation_base_fee ?? 0);
  const markup = Number(val) || 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h2 className="font-bold text-lg">Subagent activation markup</h2>
      <p className="text-sm text-muted-foreground">Admin base fee: <strong>{cedis(base)}</strong>. Add your own markup — your subagents pay the total and you earn the markup as profit.</p>
      <div className="flex items-end gap-3">
        <div>
          <label className="text-xs font-semibold">YOUR MARKUP (GH₵)</label>
          <Input type="number" min={0} step="0.01" value={val} onChange={(e) => setVal(e.target.value)} className="w-32" />
        </div>
        <div className="text-sm">
          <div className="text-muted-foreground text-xs">Total subagents pay</div>
          <div className="font-bold text-lg">{cedis(base + markup)}</div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
      </div>
    </div>
  );
}

function SubagentList({ sponsorId }: { sponsorId: string }) {
  const { data: agents } = useQuery({
    queryKey: ["my-subagents", sponsorId],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,email,full_name,phone,created_at").eq("sponsor_id", sponsorId).order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-lg">My agents ({agents?.length ?? 0})</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        People who signed up as agents from your store. Share your store link's <strong>Become an Agent</strong> button to recruit more.
      </p>
      {!agents?.length ? (
        <div className="text-sm text-muted-foreground py-4">No agents yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {agents.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.full_name ?? a.email}</div>
                <div className="text-xs text-muted-foreground truncate">{a.email} · {a.phone ?? "—"}</div>
              </div>
              <Badge variant="secondary">{new Date(a.created_at).toLocaleDateString()}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubagentPricing({ sponsorId }: { sponsorId: string }) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: packages } = useQuery({
    queryKey: ["pricing-packages"],
    queryFn: async () => (await supabase.from("data_packages").select("*").eq("active", true).order("network").order("sort_order")).data ?? [],
  });
  const { data: prices } = useQuery({
    queryKey: ["my-subagent-prices", sponsorId],
    queryFn: async () => (await supabase.from("subagent_prices").select("package_id,price").eq("sponsor_id", sponsorId)).data ?? [],
  });
  const priceMap = new Map((prices ?? []).map((o: any) => [o.package_id, Number(o.price)]));

  const save = useMutation({
    mutationFn: async ({ packageId, price }: { packageId: string; price: number | null }) => {
      if (price === null) {
        const { error } = await supabase.from("subagent_prices").delete().eq("sponsor_id", sponsorId).eq("package_id", packageId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subagent_prices").upsert(
          { sponsor_id: sponsorId, package_id: packageId, price },
          { onConflict: "sponsor_id,package_id" }
        );
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Price saved"); qc.invalidateQueries({ queryKey: ["my-subagent-prices", sponsorId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped: Record<string, any[]> = {};
  (packages ?? []).forEach((p: any) => { (grouped[p.network] ||= []).push(p); });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Tag className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-lg">Pricing for your agents</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Set the price your agents pay for each data bundle. They'll see this price when buying from their dashboard and as the base price on their own stores. The <strong>floor</strong> is your own agent price set by the admin — you can charge them more, but not less.
      </p>

      {Object.entries(grouped).map(([net, items]) => (
        <div key={net} className="mb-6">
          <h3 className="font-semibold text-sm mb-2">{NETWORK_LABELS[net] ?? net}</h3>
          <div className="divide-y divide-border">
            {items.map((p: any) => {
              const floor = Number(p.agent_price ?? p.price);
              const current = priceMap.get(p.id);
              const draft = drafts[p.id] ?? (current !== undefined ? String(current) : "");
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{p.size_label}</div>
                    <div className="text-xs text-muted-foreground">Your cost: {cedis(floor)} · Admin retail: {cedis(p.price)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      step="0.01"
                      min={floor}
                      placeholder={`≥ ${floor.toFixed(2)}`}
                      value={draft}
                      onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                      className="w-28 h-9"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const val = parseFloat(draft);
                        if (isNaN(val)) return toast.error("Enter a valid number");
                        if (val < floor) return toast.error(`Min is ${cedis(floor)}`);
                        save.mutate({ packageId: p.id, price: val });
                      }}
                    >Save</Button>
                    {current !== undefined && (
                      <Button size="sm" variant="ghost" onClick={() => { setDrafts({ ...drafts, [p.id]: "" }); save.mutate({ packageId: p.id, price: null }); }}>
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
