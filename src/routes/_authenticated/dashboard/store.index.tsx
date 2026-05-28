import { createFileRoute } from "@tanstack/react-router";
import { useMyStore, StoreShareCard, StoreOverview } from "./store";

export const Route = createFileRoute("/_authenticated/dashboard/store/")({ component: Page });

function Page() {
  const { data: store } = useMyStore();
  if (!store) return null;
  return (
    <div className="space-y-6">
      <StoreShareCard slug={store.slug} />
      <StoreOverview storeId={store.id} />
    </div>
  );
}
