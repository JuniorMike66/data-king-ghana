# Payments overhaul — reliability fixes + in-app Paystack mobile money UI

Two problems to solve in one pass:

1. **Missing records on admin dashboard / API.** Today, store orders and wallet top-ups are only written to `transactions` from the Paystack webhook OR from a verify call when the user returns to the callback URL. If the user closes their tab and the webhook fails or signature mismatches, the row is never inserted → admin never sees it, API never knows, money is paid but data is never sent. The `verify` and `webhook` handlers also disagree on the `amount` field (verify writes gross-with-fee; webhook writes net price).

2. **Replace Paystack's hosted page with our own UI**, but keep Paystack as the actual engine via their **Charge API** (`/charge`, `/charge/submit_otp`, `/charge/{reference}`).

---

## Part 1 — Reliability fixes (Part 1 is independent of the UI rewrite and ships first)

- **Insert the `transactions` row at `init` time, not at webhook/verify time.** Status starts as `pending_payment`. Webhook/verify then transitions it to `pending` (paid, awaiting provider) or `failed`. This guarantees every attempt shows on the admin dashboard regardless of whether Paystack callbacks succeed.
- Same pattern for wallet top-ups: insert a `wallet_topup` transaction at init with `pending_payment`, flip to `completed` only after Paystack confirms.
- **Unify amount semantics**: the `transactions.amount` field always stores the bundle/topup price (net). Paystack fee goes in `metadata.paystack_fee`. Fix the verify handler to match.
- **Backstop poller** (server function called from a small effect after init) that polls `/transaction/verify/{ref}` for up to 90s if the webhook hasn't moved the row. Catches dropped webhooks.
- Add `gateway_event_id` idempotency in webhook so a retried delivery doesn't double-credit (uses `event.data.id` from Paystack).

## Part 2 — Custom in-app mobile money UI (Paystack Charge API)

Flow inside our own dialog (no Paystack popup, no redirect):

```text
[Step 1: collect]   email, momo number, auto-detected network
                    ↓ call POST /api/public/v1/paystack/charge
[Paystack response] status = send_otp | pay_offline | success | failed
                    ↓
[Step 2a: OTP]      if send_otp → 6-digit input → POST /charge/submit_otp
[Step 2b: prompt]   if pay_offline → "Approve the prompt on your phone, then
                    tap I've completed payment" → POST /charge/{reference}
[Step 3]            on success → backend processes (data dispatch / wallet credit)
                    → close dialog → toast
```

### Auto-detect network from phone prefix (Ghana)
- `024 054 055 059` → MTN (`mtn`)
- `020 050` → Telecel (`vod`)
- `026 056 027 057` → AirtelTigo (`atl`)
- Show the detected network as a chip; let user override via a small dropdown.

### Momo name
Paystack's `/bank/resolve` doesn't reliably support MoMo lookup in GH and many merchants don't have it enabled. Plan: **skip name lookup** (it's not required by Paystack's charge call) and just display "MoMo prompt will show on your phone". If you want it later we can add it behind a feature flag.

### New / changed server endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/public/v1/paystack/charge` | Init charge (wallet topup OR store order OR activation). Creates the pending DB row, calls Paystack `/charge`, returns `{ reference, status, display_text }` |
| `POST /api/public/v1/paystack/submit-otp` | Forwards OTP to Paystack `/charge/submit_otp`, returns updated status |
| `POST /api/public/v1/paystack/check` | Polls `/transaction/verify/{ref}`; if success and DB still `pending_payment`, runs the same processing the webhook does |
| `POST /api/public/v1/paystack-webhook` | Kept, hardened with `gateway_event_id` idempotency |

### Changed UI

- New shared component `PaystackMomoDialog` used by:
  - Wallet top-up (`dashboard/wallet.tsx`)
  - Public store checkout (`s.$slug.tsx`)
  - Store activation (`activate-subagent.tsx`, `become-agent.tsx`)
- Removes all `window.location.href = authorization_url` redirects and the `?reference=…` callback verify dance.

### Customer-facing status
Per existing rule: customer always sees "Payment confirmed — your data is on the way". Real status only on admin dashboard. This stays.

---

## Testing (I'll run these after implementing)

1. Wallet top-up via in-app dialog (real Paystack test momo number 0551234987 → OTP `123456`).
2. Public store order via in-app dialog.
3. Force a webhook failure (block signature) → confirm backstop poller still flips the row and dispatches.
4. Verify admin dashboard shows every attempt (including `pending_payment` and `failed`).
5. Verify the public API (`/api/public/v1/data/purchase` and `transactions/$id`) returns the same records.

---

## Files I'll create/edit

**New**
- `src/components/paystack-momo-dialog.tsx` — the shared in-app payment UI
- `src/lib/paystack-charge.functions.ts` — server fns wrapping Charge API
- `src/routes/api/public/v1/paystack.charge.tsx`, `paystack.submit-otp.tsx`, `paystack.check.tsx`
- `supabase/migrations/<ts>_payment_reliability.sql` — adds `pending_payment` status value, `gateway_event_id` column with unique index

**Edit**
- `src/routes/api/public/v1/paystack-webhook.tsx` — idempotency + transition existing rows instead of insert
- `src/routes/api/public/v1/store-order.init.tsx`, `store-order.verify.tsx` — pre-insert pending row, fix amount
- `src/lib/paystack.functions.ts` — pre-insert pending wallet_topup row; keep hosted fallback only as escape hatch
- `src/routes/_authenticated/dashboard/wallet.tsx` — use new dialog
- `src/routes/s.$slug.tsx` — use new dialog
- `src/routes/activate-subagent.tsx`, `src/routes/s.$slug.become-agent.tsx` — use new dialog
- `src/routes/admin.transactions.tsx` / `admin.orders.tsx` — show new `pending_payment` and `failed` statuses with badges

This is a large change (~12 files + 1 migration). Reply **approve** to proceed, or tell me what you want to adjust (e.g. keep the hosted redirect as a fallback toggle, or drop the in-app card-only path).
