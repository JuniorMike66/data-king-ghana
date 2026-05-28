import { createFileRoute } from "@tanstack/react-router";
import { Withdrawals } from "./store";

export const Route = createFileRoute("/_authenticated/dashboard/store/withdrawals")({ component: Page });

function Page() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-bold text-lg mb-4">Withdrawals</h2>
      <Withdrawals />
    </div>
  );
}
