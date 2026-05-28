import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Check, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/s/$slug/become-agent")({ component: BecomeAgent });

const benefits = [
  { title: "Wholesale data pricing", desc: "Buy data bundles at agent prices and resell at your own markup." },
  { title: "Your own storefront", desc: "Get a shareable mini-website to sell data to your customers." },
  { title: "Instant wallet payouts", desc: "Request withdrawals to bank or Mobile Money any time." },
  { title: "Real-time order tracking", desc: "See every sale and customer order from your dashboard." },
  { title: "WhatsApp support button", desc: "Connect your WhatsApp channel for easy customer support." },
  { title: "No expiry on bundles", desc: "All data packages have no expiry date." },
];

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(9).max(20),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

function BecomeAgent() {
  const { slug } = useParams({ from: "/s/$slug/become-agent" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const { data: store, isLoading } = useQuery({
    queryKey: ["public-store-agent", slug],
    queryFn: async () =>
      (await supabase.from("stores").select("id,name,user_id,slug").eq("slug", slug).eq("active", true).maybeSingle()).data,
  });

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return toast.error("Store not found");
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          sponsor_id: store.user_id,
        },
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    // If email confirmation is disabled we already have a session; otherwise
    // try signing in so the user lands in the dashboard immediately.
    if (!signUpData.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInErr) {
        setLoading(false);
        toast.success("Account created. Please check your email to verify, then sign in.");
        setMode("login");
        return;
      }
    }
    setLoading(false);
    toast.success("Welcome aboard! You're now an agent.");
    navigate({ to: "/dashboard" });
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!store) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Store not found</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/s/$slug" params={{ slug }} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to {store.name}
          </Link>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <span className="font-bold">{store.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 grid lg:grid-cols-2 gap-10">
        <section>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Crown className="w-3.5 h-3.5" /> AGENT PROGRAM
          </div>
          <h1 className="text-4xl font-bold mb-3">Become an Agent under {store.name}</h1>
          <p className="text-muted-foreground mb-8">
            Join our agent network and start earning by selling data bundles to your community.
            Get wholesale pricing, your own storefront, and instant payouts.
          </p>
          <div className="space-y-4">
            {benefits.map((b) => (
              <div key={b.title} className="flex gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold">{b.title}</div>
                  <div className="text-sm text-muted-foreground">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sticky top-6">
            <div className="flex gap-2 mb-6 p-1 rounded-lg bg-muted">
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 rounded-md text-sm font-semibold ${mode === "signup" ? "bg-card shadow" : "text-muted-foreground"}`}
              >Create agent account</button>
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2 rounded-md text-sm font-semibold ${mode === "login" ? "bg-card shadow" : "text-muted-foreground"}`}
              >I already have one</button>
            </div>

            {mode === "signup" ? (
              <form onSubmit={onSignup} className="space-y-3">
                <div><label className="text-xs font-semibold">FULL NAME</label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
                <div><label className="text-xs font-semibold">PHONE</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
                <div><label className="text-xs font-semibold">EMAIL</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                <div><label className="text-xs font-semibold">PASSWORD</label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
                <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                  {loading ? "Creating..." : "Start as an agent"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  By signing up you'll be linked to {store.name} as your sponsor.
                </p>
              </form>
            ) : (
              <form onSubmit={onLogin} className="space-y-3">
                <div><label className="text-xs font-semibold">EMAIL</label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                <div><label className="text-xs font-semibold">PASSWORD</label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
                <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                  {loading ? "Signing in..." : "Sign in to agent dashboard"}
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
