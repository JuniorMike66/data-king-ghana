import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const NETWORK_LABELS: Record<string, string> = {
  mtn: "MTN", airteltigo_ishare: "AT iShare", airteltigo_bigtime: "AT BigTime", telecel: "Telecel",
};

export function AdminRealtimeNotifier() {
  const qc = useQueryClient();
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied"
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Force-prompt for permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then(setPerm).catch(() => {});
    }
  }, []);

  // Realtime listener on new orders
  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          const t: any = payload.new;
          if (!t || (t.type !== "data_purchase" && t.type !== "checker_purchase")) return;

          const net = t.network ? (NETWORK_LABELS[t.network] ?? t.network) : "";
          const amount = `GH₵${Number(t.amount ?? 0).toFixed(2)}`;
          const title = `New ${t.type === "data_purchase" ? "data" : "checker"} order — ${amount}`;
          const body = `${net ? net + " · " : ""}${t.recipient_phone ?? ""}${t.description ? " · " + t.description : ""}`;

          qc.invalidateQueries({ queryKey: ["admin-orders"] });
          toast.message(title, { description: body });

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const n = new Notification(title, { body, tag: t.id, icon: "/favicon.ico" });
              n.onclick = () => { window.focus(); n.close(); };
            } catch { /* ignore */ }
          }
          try {
            audioRef.current?.play().catch(() => {});
          } catch { /* ignore */ }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const requestPerm = async () => {
    if (!("Notification" in window)) {
      toast.error("This browser does not support notifications");
      return;
    }
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") toast.success("Notifications enabled");
    else toast.error("Notifications blocked — enable them in your browser site settings");
  };

  return (
    <>
      {/* Tiny embedded chime — base64 wav */}
      <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=" />
      {perm !== "granted" && (
        <Button size="sm" variant={perm === "denied" ? "destructive" : "outline"} onClick={requestPerm} className="gap-1">
          {perm === "denied" ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {perm === "denied" ? "Notifications blocked" : "Enable order alerts"}
        </Button>
      )}
    </>
  );
}
