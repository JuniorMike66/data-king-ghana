import { createFileRoute } from "@tanstack/react-router";
const make = (title: string) => () => (
  <div><h1 className="text-3xl font-bold">{title}</h1><p className="text-muted-foreground mt-2">Coming next phase.</p></div>
);
export const Route = createFileRoute("/_authenticated/dashboard/checkers")({ component: make("Result Checkers") });
