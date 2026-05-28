import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/dashboard/transactions")({
  component: () => (
    <div><h1 className="text-3xl font-bold">Transactions</h1><p className="text-muted-foreground mt-2">Coming next phase.</p></div>
  ),
});
