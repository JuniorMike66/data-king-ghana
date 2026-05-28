import { createFileRoute } from "@tanstack/react-router";
function Stub({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted-foreground">Coming in the next build phase.</p>
    </div>
  );
}
export const Route = createFileRoute("/_authenticated/dashboard/wallet")({ component: () => <Stub title="Wallet" /> });
