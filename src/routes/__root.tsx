import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { MaintenanceGate } from "@/components/maintenance-gate";

import appCss from "../styles.css?url";

/**
 * Detect the storefront home from the current path. Visitors browsing a
 * subagent/agent store (/s/<slug>/...) should bounce back to that store's
 * home — not the main DataKing site — when they hit a 404 or error.
 */
function getHomeTarget(): { href: string; label: string } {
  if (typeof window !== "undefined") {
    const m = window.location.pathname.match(/^\/s\/([^/]+)/);
    if (m) return { href: `/s/${m[1]}`, label: "Back to store" };
  }
  return { href: "/", label: "Go home" };
}

function NotFoundComponent() {
  const home = getHomeTarget();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <a
          href={home.href}
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {home.label}
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  const home = getHomeTarget();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <a href={home.href} className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{home.label}</a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DataKing Ghana — Buy data bundles & checkers" },
      { name: "description", content: "Buy MTN, AirtelTigo and Telecel data bundles and result checkers fast on DataKing Ghana." },
      { property: "og:title", content: "DataKing Ghana — Buy data bundles & checkers" },
      { name: "twitter:title", content: "DataKing Ghana — Buy data bundles & checkers" },
      { property: "og:description", content: "Buy MTN, AirtelTigo and Telecel data bundles and result checkers fast on DataKing Ghana." },
      { name: "twitter:description", content: "Buy MTN, AirtelTigo and Telecel data bundles and result checkers fast on DataKing Ghana." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/60e2f08a-df0e-4994-9ce9-43ccefe0a46c/id-preview-14222206--bc2a2106-f876-40b0-bbf4-599e535a760b.lovable.app-1779993671126.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/60e2f08a-df0e-4994-9ce9-43ccefe0a46c/id-preview-14222206--bc2a2106-f876-40b0-bbf4-599e535a760b.lovable.app-1779993671126.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MaintenanceGate>
          <Outlet />
        </MaintenanceGate>
        <FloatingWhatsApp />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
