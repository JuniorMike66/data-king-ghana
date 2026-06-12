import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminUpsertPackage, adminDeletePackage } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/packages")({ component: PackagesPage });

function PackagesPage() {
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertPackage);
  const del = useServerFn(adminDeletePackage);
  const { data } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => (await supabase.from("data_packages").select("*").order("network").order("sort_order")).data ?? [],
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-packages"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Packages</h1>
          <p className="text-muted-foreground text-sm">Manage available data bundles.</p>
        </div>
        <PackageDialog upsert={upsert} onDone={() => qc.invalidateQueries({ queryKey: ["admin-packages"] })} />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase"><tr>
            <th className="p-3">Network</th><th className="p-3">Size</th><th className="p-3">Price</th>
            <th className="p-3">Agent Price</th><th className="p-3">Active</th><th className="p-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((p: any) => (
              <tr key={p.id}>
                <td className="p-3 uppercase">{p.network}</td><td className="p-3 font-bold">{p.size_label}</td>
                <td className="p-3">GH₵{Number(p.price).toFixed(2)}</td>
                <td className="p-3">GH₵{Number(p.agent_price).toFixed(2)}</td>
                <td className="p-3">{p.active ? "✓" : "—"}</td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <PackageDialog upsert={upsert} pkg={p} onDone={() => qc.invalidateQueries({ queryKey: ["admin-packages"] })} />
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete?")) delMut.mutate(p.id); }}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PackageDialog({ upsert, pkg, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    network: pkg?.network ?? "mtn",
    size_label: pkg?.size_label ?? "",
    price: String(pkg?.price ?? 0),
    agent_price: String(pkg?.agent_price ?? 0),
    active: pkg?.active ?? true,
    provider_package_id: pkg?.provider_package_id ?? "",
  });
  const mut = useMutation({
    mutationFn: () => upsert({
      data: {
        id: pkg?.id, network: f.network as any, size_label: f.size_label,
        price: Number(f.price), agent_price: Number(f.agent_price), active: f.active,
        provider_package_id: f.provider_package_id || null,
      },
    }),
    onSuccess: () => { toast.success("Saved"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant={pkg ? "outline" : "default"}>{pkg ? "Edit" : "Add package"}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{pkg ? "Edit" : "New"} package</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Network</Label>
            <Select value={f.network} onValueChange={(v) => setF({ ...f, network: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mtn">MTN</SelectItem>
                <SelectItem value="airteltigo_ishare">AirtelTigo iShare</SelectItem>
                <SelectItem value="airteltigo_bigtime">AirtelTigo BigTime</SelectItem>
                <SelectItem value="telecel">Telecel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Size label</Label><Input value={f.size_label} onChange={(e) => setF({ ...f, size_label: e.target.value })} placeholder="e.g. 1GB or 500MB" /></div>
            <div><Label>Price</Label><Input type="number" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div><Label>Agent price</Label><Input type="number" step="0.01" value={f.agent_price} onChange={(e) => setF({ ...f, agent_price: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>SwiftData package ID</Label>
              <Input
                value={f.provider_package_id}
                onChange={(e) => setF({ ...f, provider_package_id: e.target.value.trim() })}
                placeholder="e.g. yellow_5gb (leave blank to auto-derive)"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                The exact <code>package_id</code> from SwiftData's <code>/plans</code> endpoint. If left blank we auto-derive
                from network + size (e.g. MTN 5GB → <code>yellow_5gb</code>). Override here if SwiftData uses a different ID.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Sorting is automatic based on bundle size.</p>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

