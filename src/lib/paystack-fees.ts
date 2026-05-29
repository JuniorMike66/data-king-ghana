// Gross-up an amount so the merchant receives `net` after Paystack GH fees.
// Paystack GH: 1.95% local, capped at GHS 30. We pass the cost on to the payer.
export function addPaystackFee(net: number): { gross: number; fee: number } {
  const rate = 0.0195;
  const cap = 30;
  // If uncapped fee would exceed cap, just add the cap.
  const uncapped = net / (1 - rate);
  const uncappedFee = uncapped - net;
  let gross: number;
  if (uncappedFee > cap) {
    gross = net + cap;
  } else {
    gross = uncapped;
  }
  // Round up to the nearest pesewa so we never under-collect.
  gross = Math.ceil(gross * 100) / 100;
  return { gross, fee: Math.round((gross - net) * 100) / 100 };
}
