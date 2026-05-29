import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Crown, ShieldCheck, LogOut } from "lucide-react";
import { DataKingFullPageLoader } from "@/components/dataking-loader";
import { toast } from "sonner";

type Search = { act_ref?: string };

export const Route = createFileRoute("/activate-subagent")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    act_ref: typeof s.act_ref === "string" ? s.act_ref : undefined,
  }),
  component: ActivatePage,
});

const cedis = (n: number) => `GH₵${Number(n).toFixed(2)}`;

function ActivatePage() {
  const { user, isLoading, signOut } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/login" });
  }, [isLoading, user, navigate]);

  const { data, isLoading: loadingData } = useQuery({
    queryKey: ["subagent-activation-summary", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: settings }] = await Promise.all([
        supabase.from("profiles").select("id,email,sponsor_id,subagent_activated_at").eq("id", user!.id).maybeSingle(),
        supabase.from("site_settings").select("subagent_activation_base_fee,subagent_activation_enabled").eq("id", 1).maybeSingle(),
      ]);
      if (!profile?.sponsor_id) return { notSubagent: true } as const;
      const { data: markup } = await supabase
        .from("subagent_activation_markup").select("markup").eq("sponsor_id", profile.sponsor_id).maybeSingle();
      const base = Number(settings?.subagent_activation_base_fee ?? 0);
      const m = Number(markup?.markup ?? 0);
      return {
        notSubagent: false,
        already: !!profile.subagent_activated_at,
        enabled: !!settings?.subagent_activation_enabled,
        base, markup: m, total: base + m,
        email: profile.email,
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    if (data.notSubagent) navigate({ to: "/dashboard", replace: true });
    else if (data.already || !data.enabled) navigate({ to: "/dashboard", replace: true });
  }, [data, navigate]);

  // Verify after Paystack callback
  useEffect(() => {
    if (!search.act_ref) return;
    setVerifying(true);
    (async () => {
      try {
        const res = await fetch("/api/public/v1/activation/verify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: search.act_ref }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Verification failed");
        if (j.status === "completed") {
          toast.success("Activated! Welcome to your dashboard.");
          navigate({ to: "/dashboard", search: {}, replace: true });
        } else {
          toast.error(`Payment status: ${j.status}`);
          navigate({ to: "/activate-subagent", search: {}, replace: true });
        }
      } catch (e: any) { toast.error(e.message); }
      finally { setVerifying(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.act_ref]);

  const pay = async () => {
    if (!user || !data || data.notSubagent) return;
    setPaying(true);
    try {
      const res = await fetch("/api/public/v1/activation/init", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id, kind: "subagent",
          email: data.email ?? user.email,
          origin: window.location.origin, return_path: "/activate-subagent",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not start payment");
      window.location.href = j.authorization_url;
    } catch (e: any) { toast.error(e.message); setPaying(false); }
  };

  if (isLoading || loadingData || !data || data.notSubagent || data.already || !data.enabled) {
    return <DataKingFullPageLoader />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
            <Crown className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Activate your agent account</h1>
          <p className="text-sm text-muted-foreground">A one-time activation fee unlocks your dashboard, store, and wholesale data prices.</p>
        </div>

        <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Base fee</span><span>{cedis(data.base)}</span></div>
          {data.markup > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Sponsor service fee</span><span>{cedis(data.markup)}</span></div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Total</span><span>{cedis(data.total)}</span></div>
        </div>

        <Button className="w-full h-11" onClick={pay} disabled={paying || verifying}>
          {paying ? "Redirecting…" : verifying ? "Verifying…" : `Pay ${cedis(data.total)} & activate`}
        </Button>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5" /> Secure payment via Paystack (MoMo or card)
        </div>
        <button onClick={() => signOut()} className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
