import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin access required");
}

export const adminListNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("notifications").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminUpsertNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().min(1).max(2000),
      active: z.boolean().default(true),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ title: data.title, body: data.body, active: data.active, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("notifications")
        .insert({ title: data.title, body: data.body, active: data.active });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("notifications").delete().eq("id", data.id);
    return { ok: true };
  });
