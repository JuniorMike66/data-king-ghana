import { createFileRoute } from "@tanstack/react-router";
import { useMyStore, StoreSettings } from "./store";

export const Route = createFileRoute("/_authenticated/dashboard/store/settings")({ component: Page });

function Page() {
  const { data: store } = useMyStore();
  if (!store) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-bold text-lg mb-4">Store settings</h2>
      <StoreSettings store={store} />
    </div>
  );
}
