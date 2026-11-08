import { describe, expect, it } from "vitest";
import { matchesGuestPayment } from "./guest-payment";
import { addPaystackFee } from "./paystack-fees";

describe("guest payment verification", () => {
  it("requires successful payment before sending a guest order", () => {
    expect(matchesGuestPayment(10, { status: "pending", amount: 1000, currency: "GHS" })).toBe(false);
    expect(matchesGuestPayment(10, { status: "success", amount: 1000, currency: "GHS" })).toBe(true);
  });
  it("rejects underpayment and non-Ghana currencies", () => {
    expect(matchesGuestPayment(10, { status: "success", amount: 999, currency: "GHS" })).toBe(false);
    expect(matchesGuestPayment(10, { status: "success", amount: 1000, currency: "USD" })).toBe(false);
  });
  it("includes the existing uncapped 3 percent Paystack charge", () => {
    expect(addPaystackFee(97)).toEqual({ gross: 100, fee: 3 });
    expect(addPaystackFee(9700)).toEqual({ gross: 10000, fee: 300 });
  });
});