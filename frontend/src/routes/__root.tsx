import { Link } from "@heroui/react";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { AuthContextValue } from "../contexts/AuthContext";
import { NavBar } from "../components/NavBar";
import type { NavigateOptions, ToOptions } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
interface MyRouterContext {
  auth: AuthContextValue;
}

const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const mod = await import("@tanstack/react-router-devtools");
      return { default: mod.TanStackRouterDevtools };
    })
  : null;

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div className="flex gap-4">
        <p>Page not found</p>
        <Link showAnchorIcon href="/">
          Back Home
        </Link>
      </div>
    );
  },
});
declare module "@react-types/shared" {
  interface RouterConfig {
    href: ToOptions["to"];
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

function RootComponent() {
  return (
    <main className="text-foreground bg-background min-h-screen flex flex-col items-stretch border-b">
      <NavBar />
      <div className="w-full flex-1 min-h-0 px-3 py-3 sm:px-6 sm:py-4">
        <Outlet />
      </div>
      {TanStackRouterDevtools ? (
        <Suspense fallback={null}>
          <TanStackRouterDevtools />
        </Suspense>
      ) : null}
    </main>
  );
}
