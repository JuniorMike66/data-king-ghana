# Architecture rules
- Main-site guest purchases use the shared transaction ledger with a null owner and `guest_order` source, so they remain visible to admins without assigning profits or wallets to an unrelated account.
- Guest payment confirmation validates the stored amount and currency before atomic finalization; webhook and polling share one finalizer and dispatch claim.
- Dashboard direct payments use the same verified finalizer as guests, but validate the bearer identity and resolve account pricing server-side; direct payments never debit or refund a wallet.
- Shared surface, typography, motion and navigation styles live in the global design system, so all platform areas stay visually consistent.