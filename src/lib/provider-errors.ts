export function isProviderBalanceLow(body: unknown, httpStatus: number) {
  const text = JSON.stringify(body ?? {}).toLowerCase().replace(/[_-]/g, " ");
  return httpStatus === 402 || ["insufficient balance", "insufficient funds", "insufficient api wallet", "wallet balance", "low balance", "not enough balance", "top up your"].some((phrase) => text.includes(phrase));
}