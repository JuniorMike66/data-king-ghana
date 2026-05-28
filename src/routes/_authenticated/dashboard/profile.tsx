import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({ component: Profile });

function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setForm({ full_name: data.full_name ?? "", phone: data.phone ?? "", email: data.email ?? user.email ?? "" });
    });
  }, [user]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ full_name: form.full_name, phone: form.phone }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Profile updated"),
    onError: (e: any) => toast.error(e.message),
  });
  const changePw = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Password updated"); setPw(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">My Profile</h1>
      <div className="rounded-xl border border-border p-6 bg-card space-y-4">
        <h2 className="font-bold">Account details</h2>
        <div><Label>Email</Label><Input value={form.email} disabled /></div>
        <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save changes"}</Button>
      </div>
      <div className="rounded-xl border border-border p-6 bg-card space-y-4">
        <h2 className="font-bold">Change password</h2>
        <div><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button onClick={() => changePw.mutate()} disabled={changePw.isPending || pw.length < 6}>{changePw.isPending ? "Updating..." : "Update password"}</Button>
      </div>
    </div>
  );
}
