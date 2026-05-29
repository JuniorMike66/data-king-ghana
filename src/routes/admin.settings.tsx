import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateSiteSettings } from "@/lib/site-settings.functions";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const update = useServerFn(updateSiteSettings);
  const { data, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => (await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [maintenance, setMaintenance] = useState(false);
  const [waEnabled, setWaEnabled] = useState(false);
  const [waUrl, setWaUrl] = useState("");
  const [storeActOn, setStoreActOn] = useState(false);
  const [storeActFee, setStoreActFee] = useState("0");
  const [subActOn, setSubActOn] = useState(false);
  const [subActFee, setSubActFee] = useState("0");

  useEffect(() => {
    if (data) {
      setMaintenance(!!data.maintenance_mode);
      setWaEnabled(!!data.whatsapp_enabled);
      setWaUrl(data.whatsapp_url ?? "");
      setStoreActOn(!!(data as any).store_activation_enabled);
      setStoreActFee(String((data as any).store_activation_fee ?? 0));
      setSubActOn(!!(data as any).subagent_activation_enabled);
      setSubActFee(String((data as any).subagent_activation_base_fee ?? 0));
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () => update({ data: {
      maintenance_mode: maintenance,
      whatsapp_enabled: waEnabled,
      whatsapp_url: waUrl.trim() || null,
      store_activation_enabled: storeActOn,
      store_activation_fee: Number(storeActFee) || 0,
      subagent_activation_enabled: subActOn,
      subagent_activation_base_fee: Number(subActFee) || 0,
    } }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      qc.invalidateQueries({ queryKey: ["site-settings-public"] });
      qc.invalidateQueries({ queryKey: ["site-settings-maintenance"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Site Settings</h1>
        <p className="text-muted-foreground text-sm">Global configuration for DataKing Ghana.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-base">Maintenance mode</Label>
            <p className="text-sm text-muted-foreground mt-1">When enabled, only admin accounts can access the site.</p>
          </div>
          <Switch checked={maintenance} onCheckedChange={setMaintenance} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-base">Floating WhatsApp button</Label>
            <p className="text-sm text-muted-foreground mt-1">Shows a floating WhatsApp button on the user dashboard and auth pages.</p>
          </div>
          <Switch checked={waEnabled} onCheckedChange={setWaEnabled} />
        </div>
        <div>
          <Label>WhatsApp channel URL</Label>
          <Input placeholder="https://wa.me/233XXXXXXXXX or https://whatsapp.com/channel/..." value={waUrl} onChange={(e) => setWaUrl(e.target.value)} className="mt-1.5" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-bold text-lg">Activation fees</h2>
        <p className="text-xs text-muted-foreground -mt-2">When a fee is off, that activation is free and users skip the payment step.</p>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base">Store activation (for users)</Label>
              <p className="text-sm text-muted-foreground mt-1">Charged before a user can create their first store.</p>
            </div>
            <Switch checked={storeActOn} onCheckedChange={setStoreActOn} />
          </div>
          <div>
            <Label>Store activation fee (GH₵)</Label>
            <Input type="number" min={0} step="0.01" value={storeActFee} onChange={(e) => setStoreActFee(e.target.value)} className="mt-1.5" disabled={!storeActOn} />
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base">Subagent activation</Label>
              <p className="text-sm text-muted-foreground mt-1">Subagents pay this before their dashboard unlocks. Agents can add their own markup on top.</p>
            </div>
            <Switch checked={subActOn} onCheckedChange={setSubActOn} />
          </div>
          <div>
            <Label>Subagent activation base fee (GH₵)</Label>
            <Input type="number" min={0} step="0.01" value={subActFee} onChange={(e) => setSubActFee(e.target.value)} className="mt-1.5" disabled={!subActOn} />
          </div>
        </div>
      </div>

      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? "Saving..." : "Save settings"}
      </Button>
    </div>
  );
}
