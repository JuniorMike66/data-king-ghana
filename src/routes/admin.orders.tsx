import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { adminListOrders, adminUpdateOrderStatus, adminRetryOrder } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/orders")({ component: OrdersPage });

function OrdersPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListOrders);
  const update = useServerFn(adminUpdateOrderStatus);
  const retry = useServerFn(adminRetryOrder);
  const { data } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => list(),
    refetchInterval: 15000,
  });
  const mut = useMutation({
    mutationFn: (v: any) => update({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const retryMut = useMutation({
    mutationFn: (id: string) => retry({ data: { id } }),
    onSuccess: () => { toast.success("Order retried — check status shortly"); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground text-sm">Live status — non-admin users only see "success" on their side.</p>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase"><tr>
            <th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Source</th><th className="p-3">Phone</th>
            <th className="p-3">Description</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Provider</th><th className="p-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {(data ?? []).map((t: any) => {
              const meta = t.metadata ?? {};
              const providerErr: string | undefined = meta.provider_error
                ?? (meta.provider_response && (meta.provider_response.message || meta.provider_response.error))
                ?? undefined;
              const canRetry =
                t.type === "data_purchase" &&
                (t.status === "failed" || t.status === "pending") &&
                !!t.package_id && !!t.recipient_phone;
              return (
                <tr key={t.id}>
                  <td className="p-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="p-3 capitalize">{t.type.replace("_", " ")}</td>
                  <td className="p-3 max-w-[240px]">
                    <div className="font-medium truncate" title={t.source?.label ?? ""}>{t.source?.label ?? "—"}</div>
                    {t.source?.detail && (
                      <div className="text-[11px] text-muted-foreground truncate" title={t.source.detail}>{t.source.detail}</div>
                    )}
                  </td>
                  <td className="p-3 font-mono">{t.recipient_phone ?? "—"}</td>
                  <td className="p-3">
                    {t.description}
                    {meta.retry_count ? <span className="ml-2 text-[10px] text-muted-foreground">(retried ×{meta.retry_count})</span> : null}
                  </td>
                  <td className="p-3 font-bold">GH₵{Number(t.amount).toFixed(2)}</td>
                  <td className="p-3">{t.status}</td>
                  <td className="p-3 text-xs max-w-[220px] truncate" title={providerErr ?? ""}>
                    {providerErr ? <span className="text-destructive">{providerErr}</span> : meta.provider_reference ? <span className="text-emerald-500">{meta.provider_reference}</span> : "—"}
                  </td>
                  <td className="p-3 whitespace-nowrap space-x-2">
                    {canRetry && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryMut.isPending}
                        onClick={() => retryMut.mutate(t.id)}
                        title="Retry through provider (e.g. after topping up provider balance)"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
                      </Button>
                    )}
                    <Select value={t.status} onValueChange={(v) => mut.mutate({ id: t.id, status: v })}>
                      <SelectTrigger className="h-8 w-32 inline-flex"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
