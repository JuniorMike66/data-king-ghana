import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { createApiKey, revokeApiKey } from "@/lib/api-keys.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Code, Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/developer")({ component: Dev });

function Dev() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: keys } = useQuery({
    queryKey: ["api-keys", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: () => create({ data: { name } }),
    onSuccess: (r) => { setNewKey(r.key); setName(""); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Key revoked"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Code className="w-8 h-8 text-primary" />
          <div><h1 className="text-3xl font-bold">Developer Settings</h1><p className="text-muted-foreground">API keys to automate data purchases.</p></div>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNewKey(null); }}>
          <DialogTrigger asChild><Button><KeyRound className="w-4 h-4 mr-2" />Generate key</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{newKey ? "Save this key now" : "Create API key"}</DialogTitle></DialogHeader>
            {newKey ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-500">This is the only time you'll see this key. Copy and store it safely.</p>
                <div className="rounded-lg p-3 bg-muted font-mono text-xs break-all">{newKey}</div>
                <Button className="w-full" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }}><Copy className="w-4 h-4 mr-2" />Copy key</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Key name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production key" />
                <Button className="w-full" disabled={createMut.isPending || !name} onClick={() => createMut.mutate()}>Generate</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {keys?.length === 0 && <div className="p-6 text-sm text-muted-foreground">No API keys yet.</div>}
        {keys?.map((k) => (
          <div key={k.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-semibold">{k.name} {k.revoked && <span className="text-xs ml-2 text-destructive">REVOKED</span>}</div>
              <div className="text-xs text-muted-foreground font-mono">{k.key_prefix}••••••••</div>
            </div>
            {!k.revoked && (
              <Button variant="ghost" size="icon" onClick={() => revokeMut.mutate(k.id)}><Trash2 className="w-4 h-4" /></Button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-bold">API Documentation</h2>
        <p className="text-sm text-muted-foreground">Base URL: <code className="bg-muted px-2 py-1 rounded">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/v1</code></p>
        <p className="text-sm">Authenticate with <code className="bg-muted px-1.5 py-0.5 rounded">Authorization: Bearer YOUR_KEY</code></p>

        <div className="space-y-1">
          <div className="text-sm font-semibold">Buy data</div>
          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">{`POST /api/public/v1/data/purchase
{
  "network": "mtn" | "airteltigo_ishare" | "airteltigo_bigtime" | "telecel",
  "phone": "0241234567",
  "size_mb": 1024
}

→ { "transaction_id": "...", "status": "pending|completed|failed", "amount": 5.5 }`}</pre>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-semibold">Wallet balance</div>
          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">{`GET /api/public/v1/balance
→ { "balance": 120.5, "currency": "GHS" }`}</pre>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-semibold">Transaction status</div>
          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">{`GET /api/public/v1/transactions/{id}
→ { "id": "...", "type": "data_purchase", "status": "completed", ... }`}</pre>
        </div>
      </div>
    </div>
  );
}
