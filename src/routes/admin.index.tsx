import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminListUsers, adminSetRole, adminAdjustWallet } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({ component: UsersPage });

function UsersPage() {
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm">Manage user accounts, roles, and balances.</p>
      </div>
      <Input placeholder="Search users..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
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
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
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
