export function matchesGuestPayment(gross: number, payment: { status?: string; amount?: number; currency?: string }) {
  return payment.status === "success" && payment.currency === "GHS" && Number.isFinite(gross)
    && Number(payment.amount) === Math.round(gross * 100);
}