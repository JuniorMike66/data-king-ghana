import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export function NotificationPopup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["pending-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: notes }, { data: dismissed }] = await Promise.all([
        supabase.from("notifications").select("id,title,body,created_at").eq("active", true).order("created_at", { ascending: false }),
        supabase.from("notification_dismissals").select("notification_id").eq("user_id", user!.id),
      ]);
      const dismissedSet = new Set((dismissed ?? []).map((d) => d.notification_id));
      return (notes ?? []).filter((n) => !dismissedSet.has(n.id));
    },
  });

  useEffect(() => {
    if (data && data.length > 0 && !open) {
      setCurrentId(data[0].id);
      setOpen(true);
    }
  }, [data, open]);

  const current = data?.find((n) => n.id === currentId);

  const dismiss = async () => {
    if (!current || !user) return;
    await supabase.from("notification_dismissals").insert({ user_id: user.id, notification_id: current.id });
    setOpen(false);
    setCurrentId(null);
    qc.invalidateQueries({ queryKey: ["pending-notifications", user.id] });
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent>
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-2">
            <Bell className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl">{current.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap text-base">{current.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={dismiss} className="w-full">Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
