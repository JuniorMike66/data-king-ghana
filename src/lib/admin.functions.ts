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
    const rows = data ?? [];

    // Collect IDs to enrich
    const userIds = new Set<string>();
    const storeIds = new Set<string>();
    const campaignIds = new Set<string>();
    for (const t of rows) {
      if (t.user_id) userIds.add(t.user_id);
      const m: any = t.metadata ?? {};
      if (m.store_id) storeIds.add(m.store_id);
      if (m.store_sponsor_id) userIds.add(m.store_sponsor_id);
      if (m.campaign_id) campaignIds.add(m.campaign_id);
    }

    const [profilesRes, storesRes, campaignsRes] = await Promise.all([
      userIds.size
        ? supabaseAdmin.from("profiles").select("id,full_name,email,phone,sponsor_id").in("id", Array.from(userIds))
        : Promise.resolve({ data: [] as any[] }),
      storeIds.size
        ? supabaseAdmin.from("stores").select("id,name,slug,user_id,sponsor_id").in("id", Array.from(storeIds))
        : Promise.resolve({ data: [] as any[] }),
      campaignIds.size
        ? supabaseAdmin.from("free_campaigns").select("id,name").in("id", Array.from(campaignIds))
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map<string, any>((profilesRes.data ?? []).map((p: any) => [p.id, p]));
    const storeMap = new Map<string, any>((storesRes.data ?? []).map((s: any) => [s.id, s]));
    const campaignMap = new Map<string, any>((campaignsRes.data ?? []).map((c: any) => [c.id, c]));

    // Pull sponsor profiles for stores/buyers that have one
    const sponsorIds = new Set<string>();
    for (const s of storesRes.data ?? []) if (s.sponsor_id) sponsorIds.add(s.sponsor_id);
    for (const p of profilesRes.data ?? []) if (p.sponsor_id) sponsorIds.add(p.sponsor_id);
    const missingSponsors = Array.from(sponsorIds).filter((id) => !profileMap.has(id));
    if (missingSponsors.length) {
      const { data: extra } = await supabaseAdmin
        .from("profiles").select("id,full_name,email,phone,sponsor_id").in("id", missingSponsors);
      for (const p of extra ?? []) profileMap.set(p.id, p);
    }

    const nameOf = (p: any) => (p?.full_name?.trim() || p?.email || "Unknown");

    // ============= Suspicious-activity precomputation =============
    type FlagInfo = { reasons: string[]; level: "high" | "medium" };
    const phoneTimes = new Map<string, number[]>();
    const userTimes = new Map<string, number[]>();
    for (const t of rows) {
      if (t.type !== "data_purchase") continue;
      if (t.status === "failed" || t.status === "refunded") continue;
      const ts = new Date(t.created_at).getTime();
      if (t.recipient_phone) {
        const arr = phoneTimes.get(t.recipient_phone) ?? [];
        arr.push(ts); phoneTimes.set(t.recipient_phone, arr);
      }
      if (t.user_id) {
        const arr = userTimes.get(t.user_id) ?? [];
        arr.push(ts); userTimes.set(t.user_id, arr);
      }
    }
    const countWithin = (arr: number[] | undefined, ts: number, ms: number) =>
      arr ? arr.filter((x) => Math.abs(x - ts) <= ms).length : 0;

    return rows.map((t: any) => {
      const m: any = t.metadata ?? {};
      const buyer = profileMap.get(t.user_id);
      let source: { kind: string; label: string; detail?: string };

      if (m.source === "store_order" && m.store_id) {
        const store = storeMap.get(m.store_id);
        const owner = store ? profileMap.get(store.user_id) : null;
        if (store?.sponsor_id) {
          const sponsor = profileMap.get(store.sponsor_id);
          source = {
            kind: "subagent_store",
            label: `Subagent store: ${store?.name ?? "—"}`,
            detail: `${nameOf(owner)} · sponsored by ${nameOf(sponsor)}`,
          };
        } else {
          source = {
            kind: "agent_store",
            label: `Agent store: ${store?.name ?? "—"}`,
            detail: nameOf(owner),
          };
        }
      } else if (m.source === "free_campaign" && m.campaign_id) {
        const camp = campaignMap.get(m.campaign_id);
        source = {
          kind: "free_campaign",
          label: `Free campaign${camp?.name ? `: ${camp.name}` : ""}`,
          detail: `Claimed by ${nameOf(buyer)}`,
        };
      } else if (t.type === "wallet_topup") {
        source = { kind: "wallet_topup", label: "Wallet top-up", detail: nameOf(buyer) };
      } else if (t.type === "withdrawal") {
        source = { kind: "withdrawal", label: "Withdrawal", detail: nameOf(buyer) };
      } else if (m.source === "api" || m.via === "api") {
        source = { kind: "api", label: `API — ${nameOf(buyer)}`, detail: buyer?.email ?? undefined };
      } else {
        const role = buyer?.sponsor_id ? "Subagent" : "Agent/User";
        source = {
          kind: "dashboard",
          label: `${role} dashboard: ${nameOf(buyer)}`,
          detail: buyer?.email ?? undefined,
        };
      }

      // Suspicious flags for data orders
      const flag: FlagInfo = { reasons: [], level: "medium" };
      if (t.type === "data_purchase") {
        const ts = new Date(t.created_at).getTime();
        const phoneCount = countWithin(phoneTimes.get(t.recipient_phone), ts, 30 * 60 * 1000);
        if (phoneCount >= 2) flag.reasons.push(`${phoneCount} orders to this number in 30 min`);
        const userCount = countWithin(userTimes.get(t.user_id), ts, 60 * 60 * 1000);
        if (userCount >= 8) flag.reasons.push(`${userCount} orders by this buyer in 1 hr`);
        if (m.provider_insufficient_balance) { flag.reasons.push("Provider wallet low"); flag.level = "high"; }
        const retries = Number(m.retry_count ?? 0);
        if (retries >= 2) flag.reasons.push(`Retried ${retries}×`);
        if (t.status === "pending") {
          const ageMin = (Date.now() - ts) / 60000;
          if (ageMin >= 15 && !m.provider_insufficient_balance) flag.reasons.push(`Pending ${Math.round(ageMin)}m`);
        }
      }

      return {
        ...t,
        source,
        flags: flag.reasons.length ? flag : null,
        provider_insufficient_balance: !!m.provider_insufficient_balance,
        no_refund_issued: !!m.no_refund_issued,
      };
    });
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

export const adminRetryOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: tx } = await supabaseAdmin.from("transactions").select("*").eq("id", data.id).maybeSingle();
    if (!tx) throw new Error("Order not found");
    if (tx.type !== "data_purchase") throw new Error("Only data orders can be retried");
    if (!tx.package_id || !tx.recipient_phone) throw new Error("Order is missing package or phone");
    const { data: pkg } = await supabaseAdmin.from("data_packages").select("size_mb,network").eq("id", tx.package_id).maybeSingle();
    if (!pkg) throw new Error("Package no longer exists");

    // Re-debit ONLY if the wallet was previously refunded. Insufficient-balance
    // retries keep status=pending with `no_refund_issued=true` — never re-debit
    // those, the customer already paid for the order.
    const meta: any = tx.metadata ?? {};
    const noRefundIssued = !!meta.no_refund_issued;
    if (tx.status === "failed" && !noRefundIssued) {
      const { data: wal } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", tx.user_id).maybeSingle();
      const bal = Number(wal?.balance ?? 0);
      if (bal < Number(tx.amount)) throw new Error("Customer wallet has insufficient balance for re-debit");
      await supabaseAdmin.from("wallets").update({ balance: bal - Number(tx.amount) }).eq("user_id", tx.user_id);
    }

    // Reset transaction state & clear provider lock so dispatch will run
    const cleaned = { ...meta };
    delete cleaned.dispatched_at;
    delete cleaned.provider_error;
    delete cleaned.provider_response;
    delete cleaned.http;
    delete cleaned.provider_reference;
    delete cleaned.provider_insufficient_balance;
    delete cleaned.no_refund_issued;
    cleaned.retry_count = (Number(meta.retry_count) || 0) + 1;
    cleaned.last_retry_at = new Date().toISOString();
    await supabaseAdmin.from("transactions").update({ status: "pending", metadata: cleaned }).eq("id", tx.id);

    await dispatchDataPurchase({
      transactionId: tx.id,
      userId: tx.user_id,
      network: pkg.network,
      phone: tx.recipient_phone,
      sizeMb: Number(pkg.size_mb ?? 0),
      amount: Number(tx.amount),
    });
    return { ok: true };
  });


export const adminListWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    // Only show withdrawals whose 24-hour customer-side hold has elapsed.
    // Always show non-pending statuses regardless of hold.
    const nowIso = new Date().toISOString();
    const { data } = await supabaseAdmin
      .from("withdrawals")
      .select("*, profiles:user_id(email,full_name)")
      .or(`status.neq.pending,available_at.lte.${nowIso}`)
      .order("created_at", { ascending: false });
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
    // Only refund the wallet for legacy wallet-funded withdrawals; profit withdrawals
    // are not debited from the wallet, so nothing to refund.
    if (data.status === "rejected" && w.status !== "rejected" && (w.source ?? "wallet") === "wallet") {
      const { data: wal } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", w.user_id).maybeSingle();
      if (wal) await supabaseAdmin.from("wallets").update({ balance: Number(wal.balance) + Number(w.amount) }).eq("user_id", w.user_id);
    }
    await supabaseAdmin.from("withdrawals").update({ status: data.status, admin_note: data.note ?? w.admin_note }).eq("id", data.id);
    return { ok: true };
  });


function parseSizeLabelToMb(label: string): number {
  const m = label.trim().match(/^([\d.]+)\s*(gb|mb|g|m)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "mb").toLowerCase();
  return Math.round(unit.startsWith("g") ? n * 1024 : n);
}

export const adminUpsertPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      network: z.enum(["mtn", "airteltigo_ishare", "airteltigo_bigtime", "telecel"]),
      size_label: z.string().min(1).max(20),
      price: z.number().min(0),
      agent_price: z.number().min(0),
      active: z.boolean().default(true),
      provider_package_id: z.string().trim().max(80).optional().nullable(),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const size_mb = parseSizeLabelToMb(data.size_label) || 1;
    const sort_order = size_mb; // auto-sort by size
    const payload = {
      ...data,
      size_mb,
      sort_order,
      provider_package_id: data.provider_package_id?.trim() || null,
    };
    if (data.id) {
      const { id, ...rest } = payload;
      await supabaseAdmin.from("data_packages").update(rest).eq("id", id!);
    } else {
      const { id: _ignored, ...rest } = payload;
      await supabaseAdmin.from("data_packages").insert(rest);
    }

    return { ok: true };
  });


export const adminDeletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("data_packages").delete().eq("id", data.id);
    if (error) {
      // Most likely cause: existing transactions still reference this package
      // (foreign key). Fall back to deactivating so it disappears from the
      // store UI without breaking historical order records.
      const { error: updErr } = await supabaseAdmin
        .from("data_packages")
        .update({ active: false })
        .eq("id", data.id);
      if (updErr) throw new Error(updErr.message);
      return { ok: true, deactivated: true };
    }
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

export const adminListAllTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: txs } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    const list = txs ?? [];
    const ids = Array.from(new Set(list.map((t) => t.user_id)));
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id,email,full_name,sponsor_id").in("id", ids)
      : { data: [] as any[] };
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return list.map((t) => {
      const p: any = pmap.get(t.user_id);
      return {
        ...t,
        user_email: p?.email ?? null,
        user_name: p?.full_name ?? null,
        is_subagent: !!p?.sponsor_id,
      };
    });
  });

export const adminGetUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const uid = data.userId;

    const [{ data: profile }, { data: roleRow }, { data: wallet }, { data: stores }, { data: txs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabaseAdmin.from("wallets").select("balance").eq("user_id", uid).maybeSingle(),
      supabaseAdmin.from("stores").select("id,name,slug,active,created_at").eq("user_id", uid),
      supabaseAdmin.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(200),
    ]);

    if (!profile) throw new Error("User not found");

    // Subagents = profiles whose sponsor_id is this user
    const { data: subagents } = await supabaseAdmin
      .from("profiles").select("id,email,full_name,phone,created_at").eq("sponsor_id", uid);

    // For each subagent, balance + counts
    const subIds = (subagents ?? []).map((s) => s.id);
    const { data: subWallets } = subIds.length
      ? await supabaseAdmin.from("wallets").select("user_id,balance").in("user_id", subIds)
      : { data: [] as any[] };
    const { data: subTxs } = subIds.length
      ? await supabaseAdmin.from("transactions").select("user_id,type,amount,status").in("user_id", subIds)
      : { data: [] as any[] };
    const wMap = new Map((subWallets ?? []).map((w: any) => [w.user_id, Number(w.balance)]));
    const ordersCount = new Map<string, number>();
    const spentMap = new Map<string, number>();
    (subTxs ?? []).forEach((t: any) => {
      if (t.type === "data_purchase" || t.type === "checker_purchase") {
        ordersCount.set(t.user_id, (ordersCount.get(t.user_id) ?? 0) + 1);
        if (t.status === "completed") spentMap.set(t.user_id, (spentMap.get(t.user_id) ?? 0) + Number(t.amount));
      }
    });

    const subagentRows = (subagents ?? []).map((s: any) => ({
      ...s,
      balance: wMap.get(s.id) ?? 0,
      orders: ordersCount.get(s.id) ?? 0,
      total_spent: spentMap.get(s.id) ?? 0,
    }));

    // Overview totals for this user
    const list = txs ?? [];
    const overview = {
      total_orders: list.filter((t: any) => t.type === "data_purchase" || t.type === "checker_purchase").length,
      total_spent: list
        .filter((t: any) => (t.type === "data_purchase" || t.type === "checker_purchase") && t.status === "completed")
        .reduce((s: number, t: any) => s + Number(t.amount), 0),
      total_topups: list
        .filter((t: any) => t.type === "wallet_topup" && t.status === "completed")
        .reduce((s: number, t: any) => s + Number(t.amount), 0),
      failed_orders: list.filter((t: any) => (t.type === "data_purchase" || t.type === "checker_purchase") && t.status === "failed").length,
    };

    return {
      profile: { ...profile, role: roleRow?.role ?? "user", balance: Number(wallet?.balance ?? 0) },
      stores: stores ?? [],
      transactions: list,
      subagents: subagentRows,
      overview,
    };
  });
