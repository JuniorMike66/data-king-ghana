import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, UserPlus, Crown, Mail } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FloatingOrderTracker } from "@/components/floating-order-tracker";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Sign In or Buy as Guest — DataKing Ghana" },
    { name: "description", content: "Sign in to DataKing Ghana or buy and track data bundles without an account." },
    { property: "og:title", content: "Sign In or Buy as Guest — DataKing Ghana" },
    { property: "og:description", content: "Access your account, buy data as a guest, or track an order." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate({ to: "/dashboard" });
  }, [isAuthenticated, isLoading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4 relative">
      <div className="auth-grid absolute inset-0 opacity-30" />
      <div className="auth-panel relative w-full max-w-md p-6 sm:p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="platform-brand w-14 h-14 flex items-center justify-center mb-3">
            <Crown className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide">DATAKING GHANA</h1>
          <p className="text-sm text-muted-foreground mt-1">Powering Ghana's Digital Economy</p>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Welcome Back</h2>
          <p className="text-sm text-muted-foreground mt-1">Enter your credentials to access your account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold tracking-wider mb-1.5 block">EMAIL</label>
            <Input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 bg-input/60" required />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wider mb-1.5 block">PASSWORD</label>
            <div className="relative">
              <Input type={show ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 bg-input/60 pr-10" required />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox /> <span>Remember me</span>
            </label>
            <Link to="/forgot-password" className="text-destructive hover:underline">Forgot password?</Link>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold">
            {loading ? "Signing in..." : "SIGN IN"}
          </Button>
        </form>

        <div className="my-6 border-t border-border/50" />

        <p className="text-center text-sm text-muted-foreground mb-3">Don't have an account?</p>
        <Link to="/signup">
          <Button variant="outline" className="w-full h-12 gap-2 border-border/60">
            <UserPlus className="w-4 h-4" />
            Create Account
          </Button>
        </Link>

        <div className="mt-6 pt-4 border-t border-border/30 flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary"><Link to="/buy-data">Buy data as guest</Link></Button>
          <FloatingOrderTracker inline />
        </div>

        <div className="mt-8 pt-4 border-t border-border/30 text-center">
          <p className="text-[10px] tracking-widest text-muted-foreground/70 mb-1">DEVELOPED BY</p>
          <p className="text-xs font-semibold tracking-wider flex items-center justify-center gap-1.5">
            <Mail className="w-3 h-3" /> DATAKING GHANA TEAM
          </p>
        </div>
      </div>
    </div>
  );
}
