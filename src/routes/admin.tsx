import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  adminListUsers, adminSetRole, adminAdjustWallet,
  adminListOrders, adminUpdateOrderStatus,
  adminListWithdrawals, adminUpdateWithdrawal,
  adminUpsertPackage, adminDeletePackage,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

function Admin() {
  const { isAdmin, isLoading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!isLoading && !isAdmin) nav({ to: "/dashboard" }); }, [isAdmin, isLoading, nav]);
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background adinkra-bg">
      <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur border-b border-border flex items-center px-4 md:px-6 gap-4">
        <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />Back</Link>
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="font-bold">DataKing Admin Panel</h1>
      </header>
      <div className="p-4 md:p-6">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="orders"><OrdersTab /></TabsContent>
          <TabsContent value="packages"><PackagesTab /></TabsContent>
          <TabsContent value="withdrawals"><WithdrawalsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
export const Route = createFileRoute("/admin")({ component: Admin });

function UsersTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetRole);
  const adjust = useServerFn(adminAdjustWallet);
  const [q, setQ] = useState("");
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });
  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "user" }) => setRole({ data: v }),
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  const filtered = (data ?? []).filter((u: any) =>
    !q || u.email?.toLowerCase().includes(q.toLowerCase()) || u.full_name?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4 mt-6">
      <Input placeholder="Search users..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase"><tr>
            <th className="p-3">User</th><th className="p-3">Phone</th><th className="p-3">Balance</th><th className="p-3">Role</th><th className="p-3 text-right">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u: any) => (
              <tr key={u.id}>
                <td className="p-3"><div className="font-semibold">{u.full_name ?? "—"}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                <td className="p-3">{u.phone ?? "—"}</td>
                <td className="p-3 font-bold">GH₵{u.balance.toFixed(2)}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-bold ${u.role === "admin" ? "bg-primary/20 text-primary" : "bg-muted"}`}>{u.role}</span></td>
                <td className="p-3 text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => roleMut.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })}>
                    {u.role === "admin" ? "Demote" : "Make admin"}
                  </Button>
                  <AdjustDialog userId={u.id} adjust={adjust} onDone={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdjustDialog({ userId, adjust, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const mut = useMutation({
    mutationFn: () => adjust({ data: { userId, amount: Number(amount), note } }),
    onSuccess: () => { toast.success("Adjusted"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Adjust wallet</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust wallet</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Amount (use negative to debit)</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !note}>Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrdersTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListOrders);
  const update = useServerFn(adminUpdateOrderStatus);
  const { data } = useQuery({ queryKey: ["admin-orders"], queryFn: () => list() });
  const mut = useMutation({
    mutationFn: (v: any) => update({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto mt-6">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase"><tr>
          <th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Phone</th>
          <th className="p-3">Description</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3"></th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {(data ?? []).map((t: any) => (
            <tr key={t.id}>
              <td className="p-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
              <td className="p-3 capitalize">{t.type.replace("_", " ")}</td>
              <td className="p-3 font-mono">{t.recipient_phone ?? "—"}</td>
              <td className="p-3">{t.description}</td>
              <td className="p-3 font-bold">GH₵{Number(t.amount).toFixed(2)}</td>
              <td className="p-3">{t.status}</td>
              <td className="p-3">
                <Select value={t.status} onValueChange={(v) => mut.mutate({ id: t.id, status: v })}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WithdrawalsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListWithdrawals);
  const update = useServerFn(adminUpdateWithdrawal);
  const { data } = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => list() });
  const mut = useMutation({
    mutationFn: (v: any) => update({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-withdrawals"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto mt-6">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase"><tr>
          <th className="p-3">Date</th><th className="p-3">User</th><th className="p-3">Bank</th>
          <th className="p-3">Account</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3"></th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {(data ?? []).map((w: any) => (
            <tr key={w.id}>
              <td className="p-3 whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</td>
              <td className="p-3"><div>{w.profiles?.full_name}</div><div className="text-xs text-muted-foreground">{w.profiles?.email}</div></td>
              <td className="p-3">{w.bank_name}</td>
              <td className="p-3"><div>{w.account_number}</div><div className="text-xs text-muted-foreground">{w.account_name}</div></td>
              <td className="p-3 font-bold">GH₵{Number(w.amount).toFixed(2)}</td>
              <td className="p-3">{w.status}</td>
              <td className="p-3">
                <Select value={w.status} onValueChange={(v) => mut.mutate({ id: w.id, status: v })}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="rejected">Rejected (refund)</SelectItem>
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PackagesTab() {
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
    <div className="space-y-4 mt-6">
      <div className="flex justify-end"><PackageDialog upsert={upsert} onDone={() => qc.invalidateQueries({ queryKey: ["admin-packages"] })} /></div>
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
                <td className="p-3 text-right space-x-2">
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
    size_mb: String(pkg?.size_mb ?? 1024),
    price: String(pkg?.price ?? 0),
    agent_price: String(pkg?.agent_price ?? 0),
    active: pkg?.active ?? true,
    sort_order: String(pkg?.sort_order ?? 0),
  });
  const mut = useMutation({
    mutationFn: () => upsert({
      data: {
        id: pkg?.id, network: f.network as any, size_label: f.size_label, size_mb: Number(f.size_mb),
        price: Number(f.price), agent_price: Number(f.agent_price), active: f.active, sort_order: Number(f.sort_order),
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
            <div><Label>Size label</Label><Input value={f.size_label} onChange={(e) => setF({ ...f, size_label: e.target.value })} placeholder="1GB" /></div>
            <div><Label>Size (MB)</Label><Input type="number" value={f.size_mb} onChange={(e) => setF({ ...f, size_mb: e.target.value })} /></div>
            <div><Label>Price</Label><Input type="number" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div><Label>Agent price</Label><Input type="number" step="0.01" value={f.agent_price} onChange={(e) => setF({ ...f, agent_price: e.target.value })} /></div>
            <div><Label>Sort</Label><Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></div>
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
