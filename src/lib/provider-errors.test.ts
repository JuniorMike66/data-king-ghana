import { expect, it } from "vitest";
import { isProviderBalanceLow } from "./provider-errors";
it("recognizes the provider's HTTP 400 insufficient_balance response", () => {
  expect(isProviderBalanceLow({ order: { failure_reason: "insufficient_balance" } }, 400)).toBe(true);
  expect(isProviderBalanceLow({ error: "Invalid recipient" }, 400)).toBe(false);
});