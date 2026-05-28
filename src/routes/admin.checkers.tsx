import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminUpsertChecker, adminDeleteChecker } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/checkers")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertChecker);
  const del = useServerFn(adminDeleteChecker);
  const { data } = useQuery({
    queryKey: ["admin-checkers"],
    queryFn: async () => (await supabase.from("result_checkers").select("*").order("name")).data ?? [],
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-checkers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Result Checkers</h1>
          <p className="text-muted-foreground text-sm">Manage WAEC, BECE and other exam checkers.</p>
        </div>
        <CheckerDialog upsert={upsert} onDone={() => qc.invalidateQueries({ queryKey: ["admin-checkers"] })} />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase"><tr>
            <th className="p-3">Name</th><th className="p-3">Price</th>
            <th className="p-3">Agent Price</th><th className="p-3">Active</th><th className="p-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((c: any) => (
              <tr key={c.id}>
                <td className="p-3">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>
                </td>
                <td className="p-3">GH₵{Number(c.price).toFixed(2)}</td>
                <td className="p-3">GH₵{Number(c.agent_price).toFixed(2)}</td>
                <td className="p-3">{c.active ? "✓" : "—"}</td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <CheckerDialog upsert={upsert} checker={c} onDone={() => qc.invalidateQueries({ queryKey: ["admin-checkers"] })} />
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete?")) delMut.mutate(c.id); }}>Delete</Button>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No checkers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckerDialog({ upsert, checker, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: checker?.name ?? "",
    description: checker?.description ?? "",
    price: String(checker?.price ?? 0),
    agent_price: String(checker?.agent_price ?? 0),
    active: checker?.active ?? true,
  });
  const mut = useMutation({
    mutationFn: () => upsert({
      data: {
        id: checker?.id,
        name: f.name,
        description: f.description || null,
        price: Number(f.price),
        agent_price: Number(f.agent_price),
        active: f.active,
      },
    }),
    onSuccess: () => { toast.success("Saved"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant={checker ? "outline" : "default"}>{checker ? "Edit" : "Add checker"}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{checker ? "Edit" : "New"} checker</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="WAEC Checker" /></div>
          <div><Label>Description</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price</Label><Input type="number" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div><Label>Agent price</Label><Input type="number" step="0.01" value={f.agent_price} onChange={(e) => setF({ ...f, agent_price: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <Label className="m-0">Active</Label>
            <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !f.name}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
