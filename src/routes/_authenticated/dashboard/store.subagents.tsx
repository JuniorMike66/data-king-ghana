import { createFileRoute } from "@tanstack/react-router";
import { useMyStore, SubagentManager } from "./store";

export const Route = createFileRoute("/_authenticated/dashboard/store/subagents")({ component: Page });

function Page() {
  const { data: store } = useMyStore();
  if (!store) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-bold text-lg mb-4">Subagent manager</h2>
      <SubagentManager storeId={store.id} />
    </div>
  );
}
