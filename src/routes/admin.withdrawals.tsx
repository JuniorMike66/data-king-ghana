import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { adminListWithdrawals, adminUpdateWithdrawal } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/withdrawals")({ component: WithdrawalsPage });

function WithdrawalsPage() {
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <p className="text-muted-foreground text-sm">Approve or reject withdrawal requests.</p>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase"><tr>
            <th className="p-3">Date</th><th className="p-3">User</th><th className="p-3">Momo network</th>
            <th className="p-3">Momo account</th><th className="p-3">Amount</th><th className="p-3">Source</th><th className="p-3">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((w: any) => (
              <tr key={w.id}>
                <td className="p-3 whitespace-nowrap">{new Date(w.created_at).toLocaleString()}</td>
                <td className="p-3"><div>{w.profiles?.full_name}</div><div className="text-xs text-muted-foreground">{w.profiles?.email}</div></td>
                <td className="p-3">{w.momo_network ?? w.bank_name}</td>
                <td className="p-3"><div>{w.account_number}</div><div className="text-xs text-muted-foreground">{w.account_name}</div></td>
                <td className="p-3 font-bold">GH₵{Number(w.amount).toFixed(2)}</td>
                <td className="p-3 text-xs uppercase text-muted-foreground">{w.source ?? "wallet"}</td>
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
    </div>
  );
}
