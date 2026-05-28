import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin access required");
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id,email,full_name,phone,created_at").order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");
    const { data: wallets } = await supabaseAdmin.from("wallets").select("user_id,balance");
    const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    const walletMap = new Map((wallets ?? []).map((w) => [w.user_id, Number(w.balance)]));
    return (profiles ?? []).map((p) => ({
      ...p,
      role: roleMap.get(p.id) ?? "user",
      balance: walletMap.get(p.id) ?? 0,
    }));
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), role: z.enum(["admin", "user"]) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAdjustWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ userId: z.string().uuid(), amount: z.number(), note: z.string().min(1).max(200) }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", data.userId).maybeSingle();
    const next = Number(w?.balance ?? 0) + data.amount;
    if (next < 0) throw new Error("Resulting balance would be negative");
    if (w) {
      await supabaseAdmin.from("wallets").update({ balance: next }).eq("user_id", data.userId);
    } else {
      await supabaseAdmin.from("wallets").insert({ user_id: data.userId, balance: next });
    }
    await supabaseAdmin.from("transactions").insert({
      user_id: data.userId,
      type: data.amount >= 0 ? "wallet_topup" : "refund",
      status: "completed",
      amount: Math.abs(data.amount),
      description: `Admin adjustment: ${data.note}`,
    });
    return { balance: next };
  });

export const adminListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("transactions").select("*").order("created_at", { ascending: false }).limit(500);
    return data ?? [];
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "completed", "failed", "refunded"]) }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // If failing a debit, refund the wallet
    const { data: tx } = await supabaseAdmin.from("transactions").select("*").eq("id", data.id).maybeSingle();
    if (!tx) throw new Error("Transaction not found");
    if ((data.status === "failed" || data.status === "refunded") && tx.status !== "failed" && tx.status !== "refunded"
        && (tx.type === "data_purchase" || tx.type === "checker_purchase" || tx.type === "withdrawal")) {
      const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", tx.user_id).maybeSingle();
      if (w) await supabaseAdmin.from("wallets").update({ balance: Number(w.balance) + Number(tx.amount) }).eq("user_id", tx.user_id);
    }
    await supabaseAdmin.from("transactions").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const adminListWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("withdrawals").select("*, profiles:user_id(email,full_name)").order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminUpdateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "approved", "paid", "rejected"]), note: z.string().max(200).optional() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: w } = await supabaseAdmin.from("withdrawals").select("*").eq("id", data.id).maybeSingle();
    if (!w) throw new Error("Not found");
    if (data.status === "rejected" && w.status !== "rejected") {
      const { data: wal } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", w.user_id).maybeSingle();
      if (wal) await supabaseAdmin.from("wallets").update({ balance: Number(wal.balance) + Number(w.amount) }).eq("user_id", w.user_id);
    }
    await supabaseAdmin.from("withdrawals").update({ status: data.status, admin_note: data.note ?? w.admin_note }).eq("id", data.id);
    return { ok: true };
  });

export const adminUpsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      network: z.enum(["mtn", "airteltigo_ishare", "airteltigo_bigtime", "telecel"]),
      size_label: z.string().min(1).max(20),
      size_mb: z.number().int().positive(),
      price: z.number().min(0),
      agent_price: z.number().min(0),
      active: z.boolean().default(true),
      sort_order: z.number().int().default(0),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { id, ...rest } = data;
      await supabaseAdmin.from("data_packages").update(rest).eq("id", id);
    } else {
      await supabaseAdmin.from("data_packages").insert(data);
    }
    return { ok: true };
  });

export const adminDeletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("data_packages").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminUpsertChecker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(80),
      description: z.string().max(500).optional().nullable(),
      price: z.number().min(0),
      agent_price: z.number().min(0),
      active: z.boolean().default(true),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { id, ...rest } = data;
      await supabaseAdmin.from("result_checkers").update(rest).eq("id", id);
    } else {
      await supabaseAdmin.from("result_checkers").insert(data);
    }
    return { ok: true };
  });

export const adminDeleteChecker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("result_checkers").delete().eq("id", data.id);
    return { ok: true };
  });
