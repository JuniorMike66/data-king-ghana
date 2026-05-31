import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchDataPurchase } from "@/lib/data-provider.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin access required");
}

// 8-char alphanumeric, avoiding ambiguous chars (0,O,1,I,L)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makeCode(): string {
  let s = "";
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 8; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

export const adminCreateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    name: z.string().trim().min(1).max(80),
    network: z.enum(["mtn", "airteltigo_ishare", "airteltigo_bigtime", "telecel"]),
    data_mb: z.number().int().min(1).max(200 * 1024),
    total_tokens: z.number().int().min(1).max(2000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: camp, error } = await supabaseAdmin.from("free_campaigns").insert({
      name: data.name, network: data.network, data_mb: data.data_mb,
      total_tokens: data.total_tokens, created_by: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);

    const codes = new Set<string>();
    while (codes.size < data.total_tokens) codes.add(makeCode());
    const rows = Array.from(codes).map((code) => ({ campaign_id: camp.id, code }));
    // chunked insert to avoid payload limits
    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const { error: e } = await supabaseAdmin.from("free_campaign_tokens").insert(slice);
      if (e) throw new Error(e.message);
    }
    return { id: camp.id };
  });

export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: camps } = await supabaseAdmin
      .from("free_campaigns").select("*").order("created_at", { ascending: false });
    const ids = (camps ?? []).map((c) => c.id);
    if (!ids.length) return [];
    const { data: toks } = await supabaseAdmin
      .from("free_campaign_tokens").select("campaign_id,claimed_at").in("campaign_id", ids);
    const claimedMap = new Map<string, number>();
    (toks ?? []).forEach((t) => {
      if (t.claimed_at) claimedMap.set(t.campaign_id, (claimedMap.get(t.campaign_id) ?? 0) + 1);
    });
    return (camps ?? []).map((c) => ({ ...c, claimed_count: claimedMap.get(c.id) ?? 0 }));
  });

export const adminGetCampaignTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: toks } = await supabaseAdmin
      .from("free_campaign_tokens").select("*").eq("campaign_id", data.id).order("created_at");
    return toks ?? [];
  });

export const adminUpdateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80).optional(),
    data_mb: z.number().int().min(1).max(200 * 1024).optional(),
    status: z.enum(["active", "paused", "cancelled"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...rest } = data;
    if (Object.keys(rest).length === 0) return { ok: true };
    if (rest.data_mb !== undefined) {
      const { count } = await supabaseAdmin
        .from("free_campaign_tokens").select("*", { count: "exact", head: true })
        .eq("campaign_id", id).not("claimed_at", "is", null);
      if ((count ?? 0) > 0) throw new Error("Cannot change data size after tokens have been claimed");
    }
    const { error } = await supabaseAdmin.from("free_campaigns").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("free_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const claimFreeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    code: z.string().trim().min(8).max(8).regex(/^[A-Za-z0-9]+$/),
    phone: z.string().trim().regex(/^0\d{9}$/, "Enter a valid 10-digit phone"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("claim_free_token", {
      _user_id: context.userId,
      _code: data.code.toUpperCase(),
      _phone: data.phone,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("Claim failed");

    await dispatchDataPurchase({
      transactionId: row.transaction_id,
      userId: context.userId,
      network: row.network,
      phone: data.phone,
      sizeMb: row.data_mb,
      amount: 0,
    });
    return { ok: true, transactionId: row.transaction_id };
  });
