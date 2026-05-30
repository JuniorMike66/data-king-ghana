// Ghana mobile-money network helpers shared by client + server.
// Paystack provider codes: mtn | vod | atl

export type MomoProvider = "mtn" | "vod" | "atl";

export const MOMO_PROVIDERS: { value: MomoProvider; label: string }[] = [
  { value: "mtn", label: "MTN MoMo" },
  { value: "vod", label: "Telecel Cash" },
  { value: "atl", label: "AirtelTigo Money" },
];

/** Detect the network from a 10-digit Ghana mobile number. */
export function detectMomoProvider(phone: string): MomoProvider | null {
  const p = (phone || "").replace(/\D/g, "");
  if (p.length < 3) return null;
  const prefix = p.startsWith("0") ? p.slice(0, 3) : "0" + p.slice(0, 2);
  if (["024", "054", "055", "059"].includes(prefix)) return "mtn";
  if (["020", "050"].includes(prefix)) return "vod";
  if (["026", "056", "027", "057"].includes(prefix)) return "atl";
  return null;
}

export function providerLabel(p: MomoProvider): string {
  return MOMO_PROVIDERS.find((x) => x.value === p)?.label ?? p.toUpperCase();
}
