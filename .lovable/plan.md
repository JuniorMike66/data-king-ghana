# Plan

## 1. Subagent store slug = sponsor's slug + suffix

- When a **subagent** (a profile with `sponsor_id`) creates their store, force the slug to start with their sponsor's store slug, e.g. `kingsdata-john`.
- Implementation:
  - In `CreateStoreCard` (store.tsx), if current user is a subagent, fetch sponsor's store slug, auto-prefill `{sponsorSlug}-` and lock that prefix (input only allows editing the part after the dash).
  - Server-side safety: a DB trigger on `stores` insert/update that, when `sponsor_id` is set, enforces `slug LIKE sponsor_slug || '-%'`.

## 2. Subagent pricing UX (store packages)

- In `CustomPricing` (store.tsx), detect if viewer is a subagent. If yes:
  - Show only **Base price** (= what they pay = sponsor's `subagent_prices.price`).
  - Hide "Admin retail" and admin `agent_price`.
  - Input is their selling price; the difference is their profit.
- For regular users, keep current display.

## 3. Sponsor earns profit on subagent sales (realtime)

- Currently `store_tx_cost` returns cost = sponsor's subagent_price for orders on subagent stores. So subagent's profit is calculated correctly.
- New: the **sponsor** also earns `(sponsor_subagent_price − admin_agent_price)` for every completed subagent-store sale.
- Implementation: a new SQL function `sponsor_profit_total(_user_id)` that sums over completed `data_purchase` transactions whose `metadata->>'store_id'` belongs to a store whose `sponsor_id = _user_id`, computing `(stored cost − admin agent_price)`.
- Add this to the user's profit overview: `store_profit_total + sponsor_profit_total = total profit`, and same for available. Easiest: extend `store_profit_total` and `store_profit_available` to include sponsor earnings, OR add a wrapper `total_profit_total/_available` used by the dashboard and withdrawal RPC. I'll extend the existing functions so withdrawals automatically include sponsor profit.

## 4. Activation fees

### Schema
- Extend `site_settings`:
  - `store_activation_fee numeric default 0`
  - `store_activation_enabled boolean default false`
  - `subagent_activation_base_fee numeric default 0`
  - `subagent_activation_enabled boolean default false`
- New table `activation_payments`:
  - `id`, `user_id`, `kind` (`store` | `subagent`), `amount`, `reference`, `status` (`pending`/`completed`/`failed`), `created_at`.
- Add column on `profiles`: `store_activated_at timestamptz`, `subagent_activated_at timestamptz`.
- New table `subagent_activation_markup`:
  - `sponsor_id uuid pk`, `markup numeric default 0`. Lets each agent add their own profit on top of the admin base fee. Sponsor earns the markup amount when their subagent activates.

### Flow — store activation (regular users)
- Before `CreateStoreCard` shows the form, check: if `store_activation_enabled` and `profiles.store_activated_at is null` → render an "Activate your store" card that initiates Paystack payment for `store_activation_fee`.
- New TanStack server route `/api/public/v1/activation/init` and `/api/public/v1/activation/verify` (mirroring existing store-order pattern). On verify success, set `profiles.store_activated_at = now()`, log into `activation_payments`.
- Then user sees the create-store form as today.

### Flow — subagent activation
- Subagent signs up via `become-agent` page → after login, normal redirect to `/dashboard`.
- Add a gate in `src/routes/_authenticated.tsx` (or a layout wrapper around dashboard): if user is subagent AND subagent activation enabled AND not yet activated → redirect to `/activate-subagent`.
- Build `/activate-subagent` route: shows total = `subagent_activation_base_fee + sponsor_markup`. On Paystack success, mark `profiles.subagent_activated_at = now()` AND credit sponsor's profit ledger with the markup portion (insert a synthetic `transactions` row tagged in metadata so `sponsor_profit_total` picks it up, OR a dedicated `sponsor_earnings` table — going with metadata-tagged transactions for consistency).
- Logging in always: same gate redirects until paid.

### Admin UI
- In `admin.settings.tsx`, add a section "Activation fees" with toggles + amount inputs for both store and subagent.
- When admin disables a fee, the gate is bypassed → free activation, dashboards immediately accessible.

### Agent UI for subagent markup
- New section in `store.subagents.tsx`: "Subagent activation markup" — show admin base fee, input for their markup, total. Save to `subagent_activation_markup`.

## File touches (summary)

- DB migration: site_settings columns, profiles columns, `activation_payments` + `subagent_activation_markup` tables with RLS/GRANTs, updated `store_profit_total/_available` to include sponsor earnings, new slug-enforcement trigger.
- Server routes: `api/public/v1/activation.init.tsx`, `api/public/v1/activation.verify.tsx`, extend `paystack-webhook.tsx` if needed for activation refs.
- Frontend:
  - `src/routes/_authenticated/dashboard/store.tsx` — subagent slug prefix in CreateStoreCard, subagent-aware CustomPricing.
  - `src/routes/_authenticated/dashboard/store.subagents.tsx` — activation markup card.
  - `src/routes/_authenticated.tsx` — subagent activation gate.
  - `src/routes/activate-subagent.tsx` — new route (under _authenticated).
  - `src/routes/admin.settings.tsx` — admin activation controls.

## Open question
For "Without this they should not access their dashboard" — confirmed: subagents are blocked from every authenticated route except the activation page until they pay. For **regular users** the activation fee only blocks store creation (not the rest of the dashboard like wallet/buy-data), correct?
