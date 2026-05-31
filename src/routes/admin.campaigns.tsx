import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminCreateCampaign, adminListCampaigns, adminUpdateCampaign,
  adminDeleteCampaign, adminGetCampaignTokens,
} from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Play, Pause, X, Trash2, Pencil, Gift } from "lucide-react";

export const Route = createFileRoute("/admin/campaigns")({ component: Page });

const NETWORKS = [
  { v: "mtn", l: "MTN" },
  { v: "airteltigo_ishare", l: "AirtelTigo iShare" },
  { v: "airteltigo_bigtime", l: "AirtelTigo BigTime" },
  { v: "telecel", l: "Telecel" },
];

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(adminListCampaigns);
  const create = useServerFn(adminCreateCampaign);
  const update = useServerFn(adminUpdateCampaign);
  const del = useServerFn(adminDeleteCampaign);
  const getTokens = useServerFn(adminGetCampaignTokens);

  const { data: campaigns = [] } = useQuery({ queryKey: ["admin-campaigns"], queryFn: () => list() });

  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [network, setNetwork] = useState("mtn");
  const [gb, setGb] = useState("1");
  const [count, setCount] = useState("10");

  const [tokensFor, setTokensFor] = useState<any>(null);
  const [editFor, setEditFor] = useState<any>(null);

  const createMut = useMutation({
    mutationFn: () => create({ data: {
      name, network: network as any, data_mb: Math.round(parseFloat(gb) * 1024),
      total_tokens: parseInt(count, 10),
    } }),
    onSuccess: () => {
      toast.success("Campaign created");
      setNewOpen(false); setName(""); setGb("1"); setCount("10");
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "active" | "paused" | "cancelled" }) => update({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-campaigns"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-campaigns"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: tokenList } = useQuery({
    queryKey: ["admin-campaign-tokens", tokensFor?.id],
    enabled: !!tokensFor,
    queryFn: () => getTokens({ data: { id: tokensFor.id } }),
  });

  const statusColor: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    paused: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    cancelled: "bg-red-500/15 text-red-600 border-red-500/30",
    completed: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Gift className="w-6 h-6 text-primary" /> Free Data Campaigns</h2>
          <p className="text-sm text-muted-foreground">Generate claim tokens users can redeem for free data.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>+ Start a new campaign</Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Network</th>
              <th className="p-3">Data</th>
              <th className="p-3">Claimed</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{NETWORKS.find((n) => n.v === c.network)?.l ?? c.network}</td>
                <td className="p-3">{(c.data_mb / 1024).toFixed(2)} GB</td>
                <td className="p-3">{c.claimed_count} / {c.total_tokens}</td>
                <td className="p-3"><Badge className={statusColor[c.status]} variant="outline">{c.status}</Badge></td>
                <td className="p-3 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => setTokensFor(c)}><Copy className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditFor(c)}><Pencil className="w-4 h-4" /></Button>
                  {c.status === "active" && (
                    <Button size="sm" variant="ghost" onClick={() => statusMut.mutate({ id: c.id, status: "paused" })}><Pause className="w-4 h-4" /></Button>
                  )}
                  {c.status === "paused" && (
                    <Button size="sm" variant="ghost" onClick={() => statusMut.mutate({ id: c.id, status: "active" })}><Play className="w-4 h-4" /></Button>
                  )}
                  {(c.status === "active" || c.status === "paused") && (
                    <Button size="sm" variant="ghost" onClick={() => statusMut.mutate({ id: c.id, status: "cancelled" })}><X className="w-4 h-4" /></Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Delete campaign and all tokens?")) delMut.mutate(c.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {!campaigns.length && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No campaigns yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Start a new campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Campaign name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Easter Giveaway" /></div>
            <div>
              <Label>Network</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NETWORKS.map((n) => <SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data per token (GB)</Label><Input type="number" step="0.1" min="0.1" value={gb} onChange={(e) => setGb(e.target.value)} /></div>
              <div><Label>Number of tokens</Label><Input type="number" min="1" max="2000" value={count} onChange={(e) => setCount(e.target.value)} /></div>
            </div>
            <Button className="w-full" disabled={createMut.isPending || !name} onClick={() => createMut.mutate()}>
              {createMut.isPending ? "Generating..." : "Start campaign & generate tokens"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tokens view */}
      <Dialog open={!!tokensFor} onOpenChange={(o) => !o && setTokensFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{tokensFor?.name} — Tokens</DialogTitle></DialogHeader>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const all = (tokenList ?? []).map((t: any) => t.code).join("\n");
              navigator.clipboard.writeText(all);
              toast.success("All tokens copied");
            }}>Copy all</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const unused = (tokenList ?? []).filter((t: any) => !t.claimed_at).map((t: any) => t.code).join("\n");
              navigator.clipboard.writeText(unused);
              toast.success("Unused tokens copied");
            }}>Copy unused</Button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40"><tr>
                <th className="p-2 text-left">Code</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Phone</th>
              </tr></thead>
              <tbody>
                {(tokenList ?? []).map((t: any) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2 font-mono font-semibold">{t.code}
                      <button className="ml-2 text-muted-foreground hover:text-primary" onClick={() => { navigator.clipboard.writeText(t.code); toast.success("Copied"); }}>
                        <Copy className="inline w-3 h-3" />
                      </button>
                    </td>
                    <td className="p-2">{t.claimed_at ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Claimed</Badge> : <Badge variant="outline">Unused</Badge>}</td>
                    <td className="p-2 text-muted-foreground">{t.claimed_phone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <EditDialog campaign={editFor} onClose={() => setEditFor(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-campaigns"] })} />
    </div>
  );
}

function EditDialog({ campaign, onClose, onSaved }: { campaign: any; onClose: () => void; onSaved: () => void }) {
  const update = useServerFn(adminUpdateCampaign);
  const [name, setName] = useState("");
  const [gb, setGb] = useState("");
  const mut = useMutation({
    mutationFn: () => update({ data: { id: campaign.id, name, data_mb: Math.round(parseFloat(gb) * 1024) } }),
    onSuccess: () => { toast.success("Updated"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={!!campaign} onOpenChange={(o) => { if (!o) onClose(); else { setName(campaign?.name ?? ""); setGb(((campaign?.data_mb ?? 0) / 1024).toString()); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit campaign</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Data per token (GB)</Label><Input type="number" step="0.1" min="0.1" value={gb} onChange={(e) => setGb(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Cannot be changed after any token has been claimed.</p>
          </div>
          <Button className="w-full" onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
