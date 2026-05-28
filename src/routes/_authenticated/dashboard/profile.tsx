import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
function Profile() {
  const { user } = useAuth();
  return (
    <div className="space-y-3"><h1 className="text-3xl font-bold">My Profile</h1>
      <p className="text-muted-foreground">{user?.email}</p>
      <p className="text-sm">Avatar upload, email/phone change & account deletion coming next phase.</p>
    </div>
  );
}
export const Route = createFileRoute("/_authenticated/dashboard/profile")({ component: Profile });
