import { createFileRoute } from "@tanstack/react-router";
import { PublicStore } from "./s.$slug";

export const Route = createFileRoute("/s/$slug/")({
  component: PublicStore,
});