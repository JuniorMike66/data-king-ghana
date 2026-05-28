import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

function Admin() {
  const { isAdmin, isLoading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!isLoading && !isAdmin) nav({ to: "/dashboard" });
  }, [isAdmin, isLoading, nav]);
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-3xl font-bold">Admin Panel</h1>
      <p className="text-muted-foreground">Manage users, packages, orders and withdrawals. Full UI ships in the next phase.</p>
    </div>
  );
}
export const Route = createFileRoute("/admin")({ component: Admin });
