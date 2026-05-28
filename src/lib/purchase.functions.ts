import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const buyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      packageId: z.string().uuid(),
      phone: z.string().regex(/^0\d{9}$/, "Phone must be 10 digits starting with 0"),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: txId, error } = await supabaseAdmin.rpc("purchase_data", {
      _user_id: context.userId,
      _package_id: data.packageId,
      _phone: data.phone,
    });
    if (error) throw new Error(error.message);
    return { transactionId: txId };
  });

export const buyChecker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ checkerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: txId, error } = await supabaseAdmin.rpc("purchase_checker", {
      _user_id: context.userId,
      _checker_id: data.checkerId,
    });
    if (error) throw new Error(error.message);
    return { transactionId: txId };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      amount: z.number().min(10),
      bank: z.string().min(2).max(80),
      account: z.string().min(5).max(40),
      name: z.string().min(2).max(80),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await supabaseAdmin.rpc("request_withdrawal", {
      _user_id: context.userId,
      _amount: data.amount,
      _bank: data.bank,
      _account: data.account,
      _name: data.name,
    });
    if (error) throw new Error(error.message);
    return { id };
  });
