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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code, Copy, KeyRound, Trash2, Rocket, ShieldCheck, BookOpen, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/developer")({ component: Dev });

const BASE_URL = "https://dataking.shop/api/public/v1";

function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="relative group">
      {label && <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>}
      <pre className="bg-zinc-950 text-zinc-100 p-4 rounded-lg text-xs overflow-x-auto border border-border">{children}</pre>
      <Button
        size="icon" variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-7 w-7"
        onClick={() => { navigator.clipboard.writeText(children); toast.success("Copied"); }}
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function Endpoint({ method, path, color }: { method: string; path: string; color: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <Badge className={color}>{method}</Badge>
      <code className="bg-muted px-2 py-1 rounded text-xs">{path}</code>
    </div>
  );
}

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
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Code className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Developer Portal</h1>
            <p className="text-muted-foreground">Automate data bundles and result checkers with our REST API.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNewKey(null); }}>
          <DialogTrigger asChild><Button size="lg"><KeyRound className="w-4 h-4 mr-2" />Generate API Key</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{newKey ? "Save this key now" : "Create API key"}</DialogTitle></DialogHeader>
            {newKey ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-500">⚠️ This is the only time you'll see this key. Copy and store it safely — we cannot show it again.</p>
                <div className="rounded-lg p-3 bg-muted font-mono text-xs break-all">{newKey}</div>
                <Button className="w-full" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied"); }}><Copy className="w-4 h-4 mr-2" />Copy key</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Key name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production server" />
                <Button className="w-full" disabled={createMut.isPending || !name} onClick={() => createMut.mutate()}>Generate</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <Rocket className="w-5 h-5 text-primary mb-2" />
          <div className="font-semibold">Lightning fast</div>
          <div className="text-xs text-muted-foreground">Orders dispatched to the network in seconds.</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <ShieldCheck className="w-5 h-5 text-primary mb-2" />
          <div className="font-semibold">Secure by default</div>
          <div className="text-xs text-muted-foreground">Bearer-token auth. Keys are hashed at rest.</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Zap className="w-5 h-5 text-primary mb-2" />
          <div className="font-semibold">Wallet powered</div>
          <div className="text-xs text-muted-foreground">Top up once, automate as many orders as you like.</div>
        </div>
      </div>

      {/* Keys */}
      <div>
        <h2 className="text-lg font-bold mb-3">Your API Keys</h2>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {keys?.length === 0 && <div className="p-6 text-sm text-muted-foreground">No API keys yet. Click <strong>Generate API Key</strong> above to create your first one.</div>}
          {keys?.map((k) => (
            <div key={k.id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-semibold">{k.name} {k.revoked && <Badge variant="destructive" className="ml-2">REVOKED</Badge>}</div>
                <div className="text-xs text-muted-foreground font-mono">{k.key_prefix}••••••••••••••••</div>
                {k.last_used_at && <div className="text-xs text-muted-foreground mt-1">Last used: {new Date(k.last_used_at).toLocaleString()}</div>}
              </div>
              {!k.revoked && (
                <Button variant="ghost" size="icon" onClick={() => revokeMut.mutate(k.id)}><Trash2 className="w-4 h-4" /></Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Getting started */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Getting Started (5 minutes)</h2>
        </div>
        <p className="text-sm text-muted-foreground">New to APIs? No worries — follow these steps and you'll be making your first sale in no time.</p>

        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
            <div><strong>Top up your wallet.</strong> Every API order is paid from your DataKing wallet — make sure you have funds before sending requests.</div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
            <div><strong>Generate an API key</strong> above. Treat it like a password — anyone with this key can spend your wallet.</div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
            <div><strong>Send every request</strong> with the header <code className="bg-muted px-1.5 py-0.5 rounded text-xs">Authorization: Bearer YOUR_KEY</code></div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
            <div><strong>Test with curl</strong> below before wiring it into your app. If the test works, your integration will too.</div>
          </li>
        </ol>

        <div className="pt-2">
          <div className="text-sm font-semibold mb-2">Base URL</div>
          <CodeBlock>{BASE_URL}</CodeBlock>
        </div>
      </div>

      {/* Endpoints */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Endpoints</h2>

        {/* Buy Data */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <Endpoint method="POST" path="/data/purchase" color="bg-green-600 hover:bg-green-600" />
              <h3 className="font-bold text-lg mt-2">Buy data bundle</h3>
              <p className="text-sm text-muted-foreground">Send airtime data to any Ghanaian number. The recipient receives the bundle within seconds.</p>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Request body</div>
            <CodeBlock>{`{
  "network": "mtn",            // mtn | airteltigo_ishare | airteltigo_bigtime | telecel
  "phone": "0241234567",       // 10 digits, must start with 0
  "size_mb": 1024              // size in MB. 1GB = 1024, 2GB = 2048, 5GB = 5120
}`}</CodeBlock>
          </div>

          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="js">JavaScript</TabsTrigger>
              <TabsTrigger value="php">PHP</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl">
              <CodeBlock>{`curl -X POST ${BASE_URL}/data/purchase \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "mtn",
    "phone": "0241234567",
    "size_mb": 1024
  }'`}</CodeBlock>
            </TabsContent>
            <TabsContent value="js">
              <CodeBlock>{`const res = await fetch("${BASE_URL}/data/purchase", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    network: "mtn",
    phone: "0241234567",
    size_mb: 1024,
  }),
});
const data = await res.json();
console.log(data); // { transaction_id, status, amount }`}</CodeBlock>
            </TabsContent>
            <TabsContent value="php">
              <CodeBlock>{`<?php
$ch = curl_init("${BASE_URL}/data/purchase");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Authorization: Bearer YOUR_API_KEY",
  "Content-Type: application/json",
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
  "network" => "mtn",
  "phone" => "0241234567",
  "size_mb" => 1024,
]));
$response = curl_exec($ch);
curl_close($ch);
echo $response;`}</CodeBlock>
            </TabsContent>
            <TabsContent value="python">
              <CodeBlock>{`import requests

r = requests.post(
    "${BASE_URL}/data/purchase",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"network": "mtn", "phone": "0241234567", "size_mb": 1024},
)
print(r.json())`}</CodeBlock>
            </TabsContent>
          </Tabs>

          <div>
            <div className="text-sm font-semibold mb-2">Success response (200)</div>
            <CodeBlock>{`{
  "transaction_id": "a1b2c3d4-...",
  "status": "completed",   // completed | pending | failed
  "amount": 5.50
}`}</CodeBlock>
          </div>
        </div>

        {/* Result Checkers */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <Endpoint method="GET" path="/checkers/purchase" color="bg-blue-600 hover:bg-blue-600" />
            <h3 className="font-bold text-lg mt-2">List available result checkers</h3>
            <p className="text-sm text-muted-foreground">Returns every active checker (WAEC, BECE, etc.) with its UUID and price. Use the ID to purchase.</p>
          </div>

          <CodeBlock>{`curl ${BASE_URL}/checkers/purchase \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</CodeBlock>

          <div>
            <div className="text-sm font-semibold mb-2">Response</div>
            <CodeBlock>{`{
  "checkers": [
    { "id": "uuid-...", "name": "WAEC Checker", "description": "...", "price": 17.50 },
    { "id": "uuid-...", "name": "BECE Checker", "description": "...", "price": 19.00 }
  ]
}`}</CodeBlock>
          </div>

          <div className="border-t border-border pt-4">
            <Endpoint method="POST" path="/checkers/purchase" color="bg-green-600 hover:bg-green-600" />
            <h3 className="font-bold text-lg mt-2">Buy a result checker</h3>
            <p className="text-sm text-muted-foreground">Sends the checker PIN/Serial via SMS to the recipient number you provide.</p>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Request body</div>
            <CodeBlock>{`{
  "checker_id": "uuid-from-list-endpoint",
  "phone": "0241234567"      // recipient who receives the PIN
}`}</CodeBlock>
          </div>

          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="js">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl">
              <CodeBlock>{`curl -X POST ${BASE_URL}/checkers/purchase \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "checker_id": "PASTE_CHECKER_UUID",
    "phone": "0241234567"
  }'`}</CodeBlock>
            </TabsContent>
            <TabsContent value="js">
              <CodeBlock>{`const res = await fetch("${BASE_URL}/checkers/purchase", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    checker_id: "PASTE_CHECKER_UUID",
    phone: "0241234567",
  }),
});
console.log(await res.json());`}</CodeBlock>
            </TabsContent>
            <TabsContent value="python">
              <CodeBlock>{`import requests
r = requests.post(
    "${BASE_URL}/checkers/purchase",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"checker_id": "PASTE_CHECKER_UUID", "phone": "0241234567"},
)
print(r.json())`}</CodeBlock>
            </TabsContent>
          </Tabs>

          <div>
            <div className="text-sm font-semibold mb-2">Success response (200)</div>
            <CodeBlock>{`{
  "transaction_id": "a1b2c3d4-...",
  "status": "completed",
  "amount": 17.50
}`}</CodeBlock>
          </div>
        </div>

        {/* Wallet balance */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <Endpoint method="GET" path="/balance" color="bg-blue-600 hover:bg-blue-600" />
            <h3 className="font-bold text-lg mt-2">Check wallet balance</h3>
            <p className="text-sm text-muted-foreground">Use this before placing orders to make sure you have enough funds.</p>
          </div>

          <CodeBlock>{`curl ${BASE_URL}/balance \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</CodeBlock>

          <div>
            <div className="text-sm font-semibold mb-2">Response</div>
            <CodeBlock>{`{ "balance": 120.50, "currency": "GHS" }`}</CodeBlock>
          </div>
        </div>

        {/* Transaction status */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div>
            <Endpoint method="GET" path="/transactions/{id}" color="bg-blue-600 hover:bg-blue-600" />
            <h3 className="font-bold text-lg mt-2">Check transaction status</h3>
            <p className="text-sm text-muted-foreground">Look up a single order by the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">transaction_id</code> returned from a purchase.</p>
          </div>

          <CodeBlock>{`curl ${BASE_URL}/transactions/a1b2c3d4-... \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</CodeBlock>

          <div>
            <div className="text-sm font-semibold mb-2">Response</div>
            <CodeBlock>{`{
  "id": "a1b2c3d4-...",
  "type": "data_purchase",   // or "checker_purchase"
  "status": "completed",
  "amount": 5.50,
  "created_at": "2026-05-28T12:34:56Z"
}`}</CodeBlock>
          </div>
        </div>
      </div>

      {/* Errors */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold">Error codes</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border p-3"><div className="font-mono font-bold">400</div><div className="text-xs text-muted-foreground">Invalid input. Check your JSON body.</div></div>
          <div className="rounded-lg border border-border p-3"><div className="font-mono font-bold">401</div><div className="text-xs text-muted-foreground">Missing or invalid API key.</div></div>
          <div className="rounded-lg border border-border p-3"><div className="font-mono font-bold">402</div><div className="text-xs text-muted-foreground">Insufficient wallet balance — top up and retry.</div></div>
          <div className="rounded-lg border border-border p-3"><div className="font-mono font-bold">404</div><div className="text-xs text-muted-foreground">Package or resource not found.</div></div>
        </div>
      </div>

      {/* Best practices */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <h2 className="text-xl font-bold">Best practices</h2>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li><strong className="text-foreground">Never expose your API key</strong> in client-side JavaScript or mobile apps. Always call our API from your server.</li>
          <li><strong className="text-foreground">Save the transaction_id</strong> from every purchase so you can reconcile later if needed.</li>
          <li><strong className="text-foreground">Validate the phone number</strong> on your side (10 digits, starts with 0) before calling the API to avoid 400 errors.</li>
          <li><strong className="text-foreground">Monitor your wallet</strong> — set up automatic top-ups so your service never runs dry.</li>
          <li><strong className="text-foreground">Rotate keys</strong> every few months. Revoke any key that may have been exposed and generate a new one.</li>
        </ul>
      </div>
    </div>
  );
}
