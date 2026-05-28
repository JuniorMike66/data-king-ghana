import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Wallet, Receipt, ShoppingCart, FileCheck,
  Store, Code, User, AlertCircle, LogOut, Menu, Shield, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

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
const more = [
  { to: "/dashboard/checkers", label: "Result Checkers", icon: FileCheck },
  { to: "/dashboard/store", label: "My Store", icon: Store },
  { to: "/dashboard/developer", label: "Developer Settings", icon: Code },
  { to: "/dashboard/profile", label: "My Profile", icon: User },
  { to: "/dashboard/report", label: "Report an Issue", icon: AlertCircle },
];

function Sidebar({ onNav }: { onNav?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin, signOut, user } = useAuth();
  const isActive = (to: string) => path === to;
  const buyOpen = path.startsWith("/dashboard/buy-data");

  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
      active ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    );

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground w-64">
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

      <nav className="flex-1 px-3 pb-3 space-y-1 overflow-y-auto">
        {nav.map((i) => (
          <Link key={i.to} to={i.to} onClick={onNav} className={linkCls(isActive(i.to))}>
            <i.icon className="w-4 h-4" /> {i.label}
          </Link>
        ))}
        <Collapsible defaultOpen={buyOpen}>
          <CollapsibleTrigger className={cn(linkCls(false), "w-full justify-between")}>
            <span className="flex items-center gap-3"><ShoppingCart className="w-4 h-4" /> Buy Data</span>
            <ChevronDown className="w-4 h-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-7 mt-1 space-y-1">
            {buyData.map((i) => (
              <Link key={i.to} to={i.to} onClick={onNav} className={linkCls(isActive(i.to))}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />{i.label}
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
        {more.map((i) => (
          <Link key={i.to} to={i.to} onClick={onNav} className={linkCls(isActive(i.to))}>
            <i.icon className="w-4 h-4" /> {i.label}
          </Link>
        ))}
        {isAdmin && (
          <Link to="/admin" onClick={onNav} className={cn(linkCls(path.startsWith("/admin")), "mt-3 border border-primary/30")}>
            <Shield className="w-4 h-4" /> Admin Panel
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
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:block sticky top-0 h-screen border-r border-sidebar-border">
        <Sidebar />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
          <Sidebar onNav={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0 adinkra-bg">
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur border-b border-border flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <h1 className="font-bold text-lg">DataKing Ghana</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1.5 text-sm">
            <Wallet className="w-4 h-4 text-primary" /> <span className="font-semibold">GH₵ 0.00</span>
          </div>
        </header>
        <div className="relative p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
