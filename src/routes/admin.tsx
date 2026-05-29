import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, ArrowLeft, Users, ShoppingBag, Package, Banknote, Settings, Bell, FileCheck, LogOut, Menu, Receipt } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AdminRealtimeNotifier } from "@/components/admin-realtime-notifier";


export const Route = createFileRoute("/admin")({ component: AdminLayout });

const items = [
  { to: "/admin", label: "Users", icon: Users, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt },
  { to: "/admin/packages", label: "Packages", icon: Package },
  { to: "/admin/checkers", label: "Result Checkers", icon: FileCheck },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
  { to: "/admin/settings", label: "Site Settings", icon: Settings },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
];

function AdminSidebar({ onNav }: { onNav?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { signOut, user } = useAuth();
  const isActive = (to: string, exact?: boolean) => (exact ? path === to : path === to || path.startsWith(to + "/"));
  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-3 rounded-lg text-base leading-relaxed transition-colors",
      active ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    );

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground w-72">
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-amber-700 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <div className="font-bold">DataKing GH</div>
          <div className="text-[10px] tracking-widest text-muted-foreground">ADMIN PANEL</div>
        </div>
      </div>

      <div className="p-3 m-3 rounded-xl bg-sidebar-accent border border-sidebar-border">
        <div className="text-xs text-muted-foreground">Admin</div>
        <div className="text-sm font-semibold truncate">{user?.email}</div>
      </div>

      <nav className="flex-1 px-3 pb-3 space-y-1.5 overflow-y-auto">
        {items.map((i) => (
          <Link key={i.to} to={i.to} onClick={onNav} className={linkCls(isActive(i.to, i.exact))}>
            <i.icon className="w-5 h-5" /> {i.label}
          </Link>
        ))}
        <Link to="/dashboard" onClick={onNav} className={cn(linkCls(false), "mt-3 border border-border")}>
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </Link>
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button onClick={() => signOut()} className="w-full flex items-center justify-center gap-2 text-destructive font-semibold py-2.5 hover:bg-destructive/10 rounded-lg">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}

function AdminLayout() {
  const { isAdmin, isLoading } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!isLoading && !isAdmin) nav({ to: "/dashboard" }); }, [isAdmin, isLoading, nav]);
  if (isLoading || !isAdmin) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:block sticky top-0 h-screen border-r border-sidebar-border">
        <AdminSidebar />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
          <AdminSidebar onNav={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0 adinkra-bg">
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur border-b border-border flex items-center px-4 md:px-6 gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="font-bold flex-1">DataKing Admin Panel</h1>
          <AdminRealtimeNotifier />
        </header>

        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
