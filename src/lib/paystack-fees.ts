// Gross-up an amount so the merchant receives `net` after Paystack GH fees.
// We pass the fee on to the payer on every transaction (no cap).
export function addPaystackFee(net: number): { gross: number; fee: number } {
  const rate = 0.0195;
  // gross * (1 - rate) = net  =>  gross = net / (1 - rate)
  const raw = net / (1 - rate);
  // Round up to the nearest pesewa so we never under-collect.
  const gross = Math.ceil(raw * 100) / 100;
  return { gross, fee: Math.round((gross - net) * 100) / 100 };
}
