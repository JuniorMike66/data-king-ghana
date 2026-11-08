# Architecture rules
- Main-site guest purchases use the shared transaction ledger with a null owner and `guest_order` source, so they remain visible to admins without assigning profits or wallets to an unrelated account.
- Guest payment confirmation validates the stored amount and currency before atomic finalization; webhook and polling share one finalizer and dispatch claim.