import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Wallet, Receipt, ShoppingCart, FileCheck,
  Store, Code, User, AlertCircle, LogOut, Menu, Shield, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import * as profileMod from "@/lib/use-profile";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { NotificationPopup } from "@/components/notification-popup";
import { FloatingOrderTracker } from "@/components/floating-order-tracker";

export const Route = createFileRoute("/_authenticated")({ component: Layout });

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { to: "/dashboard/transactions", label: "Transactions", icon: Receipt },
];
const buyData = [
  { to: "/dashboard/buy-data/mtn", label: "MTN Data" },
  { to: "/dashboard/buy-data/at-ishare", label: "AirtelTigo iShare" },
  { to: "/dashboard/buy-data/at-bigtime", label: "AirtelTigo BigTime" },
  { to: "/dashboard/buy-data/telecel", label: "Telecel" },
];
const storeNav = [
  { to: "/dashboard/store", label: "Overview" },
  { to: "/dashboard/store/packages", label: "Store Packages" },
  { to: "/dashboard/store/settings", label: "Store Settings" },
  { to: "/dashboard/store/transactions", label: "Store Transactions" },
  { to: "/dashboard/store/subagents", label: "Subagent Manager", sponsorOnly: true },
  { to: "/dashboard/store/withdrawals", label: "Withdrawals" },
];

const more = [
  { to: "/dashboard/checkers", label: "Result Checkers", icon: FileCheck },
  { to: "/dashboard/developer", label: "Developer Settings", icon: Code },
  { to: "/dashboard/profile", label: "My Profile", icon: User },
  { to: "/dashboard/report", label: "Report an Issue", icon: AlertCircle },
];

function Sidebar({ onNav }: { onNav?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin, signOut, user } = useAuth();
  const { isSubagent } = profileMod.useProfile();
  const isActive = (to: string) => path === to;
  const buyOpen = path.startsWith("/dashboard/buy-data");
  const storeOpen = path.startsWith("/dashboard/store");


  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-3 rounded-lg text-base leading-relaxed transition-colors",
      active ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    );

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground w-72">
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-amber-700 flex items-center justify-center font-bold text-primary-foreground">DK</div>
        <div>
          <div className="font-bold">DataKing GH</div>
          <div className="text-[10px] tracking-widest text-muted-foreground">USER CONSOLE</div>
        </div>
      </div>

      <div className="p-3 m-3 rounded-xl bg-sidebar-accent border border-sidebar-border">
        <div className="text-xs text-muted-foreground">Signed in as</div>
        <div className="text-sm font-semibold truncate">{user?.email}</div>
      </div>

      <nav className="flex-1 px-3 pb-3 space-y-1.5 overflow-y-auto">
        {nav.map((i) => (
          <Link key={i.to} to={i.to} onClick={onNav} className={linkCls(isActive(i.to))}>
            <i.icon className="w-5 h-5" /> {i.label}
          </Link>
        ))}
        <Collapsible defaultOpen={buyOpen}>
          <CollapsibleTrigger className={cn(linkCls(false), "w-full justify-between")}>
            <span className="flex items-center gap-3"><ShoppingCart className="w-5 h-5" /> Buy Data</span>
            <ChevronDown className="w-4 h-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-7 mt-1.5 space-y-1.5">
            {buyData.map((i) => (
              <Link key={i.to} to={i.to} onClick={onNav} className={linkCls(isActive(i.to))}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />{i.label}
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
        <Collapsible defaultOpen={storeOpen}>
          <CollapsibleTrigger className={cn(linkCls(false), "w-full justify-between")}>
            <span className="flex items-center gap-3"><Store className="w-5 h-5" /> My Store</span>
            <ChevronDown className="w-4 h-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-7 mt-1.5 space-y-1.5">
            {storeNav.filter((i) => !i.sponsorOnly || !isSubagent).map((i) => (
              <Link key={i.to} to={i.to} onClick={onNav} className={linkCls(isActive(i.to))}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />{i.label}
              </Link>
            ))}
          </CollapsibleContent>

        </Collapsible>
        {more.map((i) => (
          <Link key={i.to} to={i.to} onClick={onNav} className={linkCls(isActive(i.to))}>
            <i.icon className="w-5 h-5" /> {i.label}
          </Link>
        ))}
        {isAdmin && (
          <Link to="/admin" onClick={onNav} className={cn(linkCls(path.startsWith("/admin")), "mt-3 border border-primary/30")}>
            <Shield className="w-5 h-5" /> Admin Panel
          </Link>
        )}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button onClick={() => signOut()} className="w-full flex items-center justify-center gap-2 text-destructive font-semibold py-2.5 hover:bg-destructive/10 rounded-lg">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}

function Layout() {
  const { isAuthenticated, isLoading, isAdmin, user } = useAuth();
  const { isSubagent, subagentActivatedAt, isLoading: profileLoading } = profileMod.useProfile();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isAuthenticated, isLoading, navigate]);

  // Subagent activation gate
  const { data: actSettings } = useQuery({
    queryKey: ["site-settings-activation"],
    queryFn: async () => (await supabase.from("site_settings").select("subagent_activation_enabled").eq("id", 1).maybeSingle()).data,
  });
  const needsActivation = !isAdmin && isSubagent && !subagentActivatedAt && !!actSettings?.subagent_activation_enabled;
  useEffect(() => {
    if (!isLoading && !profileLoading && needsActivation && path !== "/activate-subagent") {
      navigate({ to: "/activate-subagent", replace: true });
    }
  }, [isLoading, profileLoading, needsActivation, path, navigate]);

  const { data: balance } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle();
      return Number(data?.balance ?? 0);
    },
  });

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:block sticky top-0 h-screen border-r border-sidebar-border">
        <Sidebar />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
          <Sidebar onNav={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <NotificationPopup />
      <main className="flex-1 min-w-0 adinkra-bg">
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur border-b border-border flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="font-bold text-lg">DataKing Ghana</h1>
          </div>
          <Link to="/dashboard/wallet" className="hidden sm:flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1.5 text-sm hover:bg-primary/10">
            <Wallet className="w-4 h-4 text-primary" /> <span className="font-semibold">GH₵ {(balance ?? 0).toFixed(2)}</span>
          </Link>
        </header>
        <div className="relative p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      <FloatingOrderTracker />
    </div>
  );
}
