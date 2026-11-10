import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "IQ DataHub — Data Bundles and Guest Orders" },
    { name: "description", content: "Buy and track data bundles with IQ DataHub, with or without an account." },
    { property: "og:title", content: "IQ DataHub — Data Bundles and Guest Orders" },
    { property: "og:description", content: "Buy and track MTN, AirtelTigo and Telecel data bundles." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
