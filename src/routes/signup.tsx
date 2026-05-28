import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Crown } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(9).max(20),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created! Check your email to verify.");
    navigate({ to: "/login" });
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4 relative">
      <div className="auth-grid absolute inset-0 opacity-30" />
      <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center mb-3 shadow-lg">
            <Crown className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide">DATAKING GHANA</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your account</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold tracking-wider mb-1.5 block">FULL NAME</label>
            <Input className="h-12 bg-input/60" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wider mb-1.5 block">PHONE</label>
            <Input className="h-12 bg-input/60" placeholder="+233..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wider mb-1.5 block">EMAIL</label>
            <Input type="email" className="h-12 bg-input/60" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wider mb-1.5 block">PASSWORD</label>
            <Input type="password" className="h-12 bg-input/60" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold bg-gradient-to-r from-[oklch(0.75_0.20_30)] to-[oklch(0.65_0.22_15)] text-white border-0">
            {loading ? "Creating..." : "CREATE ACCOUNT"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
