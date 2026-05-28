import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin access required");
}

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      maintenance_mode: z.boolean(),
      whatsapp_enabled: z.boolean(),
      whatsapp_url: z.string().trim().max(500).optional().nullable(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("site_settings")
      .update({
        maintenance_mode: data.maintenance_mode,
        whatsapp_enabled: data.whatsapp_enabled,
        whatsapp_url: data.whatsapp_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
