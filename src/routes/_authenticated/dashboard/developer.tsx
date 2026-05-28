import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/dashboard/developer")({
  component: () => <div><h1 className="text-3xl font-bold">Developer Settings</h1><p className="text-muted-foreground mt-2">Generate API keys & docs — next phase.</p></div>,
});
