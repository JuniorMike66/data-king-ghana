import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const raw = "dk_live_" + randomBytes(24).toString("hex");
    const hash = createHash("sha256").update(raw).digest("hex");
    const prefix = raw.slice(0, 12);
    const { error } = await supabaseAdmin.from("api_keys").insert({
      user_id: context.userId,
      name: data.name,
      key_hash: hash,
      key_prefix: prefix,
    });
    if (error) throw new Error(error.message);
    return { key: raw, prefix };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
