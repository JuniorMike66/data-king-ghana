import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const ALWAYS_ALLOWED = ["/login", "/signup", "/forgot-password"];

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading, isAuthenticated, signOut } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { data, isLoading: settingsLoading } = useQuery({
    queryKey: ["site-settings-maintenance"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("maintenance_mode").eq("id", 1).maybeSingle();
      return data;
    },
    staleTime: 30_000,
  });

  if (isLoading || settingsLoading) return <>{children}</>;
  if (!data?.maintenance_mode) return <>{children}</>;
  if (isAdmin) return <>{children}</>;
  if (ALWAYS_ALLOWED.includes(path)) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background adinkra-bg">
      <div className="max-w-md text-center rounded-2xl border border-border bg-card/80 backdrop-blur p-8 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto mb-4">
          <Wrench className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold">We'll be right back</h1>
        <p className="mt-2 text-muted-foreground">
          DataKing Ghana is currently undergoing maintenance. Please check back shortly.
        </p>
        {isAuthenticated && (
          <Button variant="outline" className="mt-6" onClick={() => signOut()}>Sign out</Button>
        )}
      </div>
    </div>
  );
}
