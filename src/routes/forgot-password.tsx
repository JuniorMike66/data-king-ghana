import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/forgot-password")({ component: Page });

function Page() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email for the reset link.");
  };
  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-8">
        <h1 className="text-xl font-bold mb-2">Reset your password</h1>
        <p className="text-sm text-muted-foreground mb-6">We'll email you a link.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input type="email" placeholder="you@email.com" className="h-12 bg-input/60" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" disabled={loading} className="w-full h-12">{loading ? "Sending..." : "Send reset link"}</Button>
        </form>
        <p className="text-center text-sm mt-4"><Link to="/login" className="text-primary hover:underline">Back to sign in</Link></p>
      </div>
    </div>
  );
}
