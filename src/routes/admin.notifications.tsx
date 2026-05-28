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
import { adminListNotifications, adminUpsertNotification, adminDeleteNotification } from "@/lib/notifications.functions";

export const Route = createFileRoute("/admin/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListNotifications);
  const upsert = useServerFn(adminUpsertNotification);
  const del = useServerFn(adminDeleteNotification);
  const { data } = useQuery({ queryKey: ["admin-notifications"], queryFn: () => list() });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-notifications"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Popup Notifications</h1>
          <p className="text-muted-foreground text-sm">Send a popup message that appears for users on their dashboard. They can close it once.</p>
        </div>
        <NotificationDialog upsert={upsert} onDone={() => qc.invalidateQueries({ queryKey: ["admin-notifications"] })} />
      </div>

      <div className="grid gap-3">
        {(data ?? []).length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
            No notifications yet. Click "New notification" to send your first one.
          </div>
        )}
        {(data ?? []).map((n: any) => (
          <div key={n.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{n.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded ${n.active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                  {n.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</p>
              <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <NotificationDialog upsert={upsert} note={n} onDone={() => qc.invalidateQueries({ queryKey: ["admin-notifications"] })} />
              <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this notification?")) delMut.mutate(n.id); }}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationDialog({ upsert, note, onDone }: any) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [active, setActive] = useState(note?.active ?? true);
  const mut = useMutation({
    mutationFn: () => upsert({ data: { id: note?.id, title, body, active } }),
    onSuccess: () => { toast.success("Saved"); setOpen(false); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={note ? "outline" : "default"}>{note ? "Edit" : "New notification"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{note ? "Edit notification" : "New notification"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scheduled maintenance tonight" />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Write your message to users..." />
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !title.trim() || !body.trim()}>
            {mut.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
