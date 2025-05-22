import { HeroUIProvider, Link } from "@heroui/react";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { AuthContext } from "../contexts/AuthContext";
import { NavBar } from "../components/NavBar";
import { useTheme } from "../contexts/ThemeContext";
import type { NavigateOptions, ToOptions } from "@tanstack/react-router";
interface MyRouterContext {
  auth: AuthContext;
}

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
  const { auth } = Route.useRouteContext();
  const { theme } = useTheme();

  const router = useRouter();

  return (
    <HeroUIProvider
      navigate={(to, options) => router.navigate({ to, ...options })}
      useHref={(to) => router.buildLocation({ to }).href}
    >
      <main className={`${theme} text-foreground bg-background min-h-screen flex flex-col items-center border-b gap-2`}>
        <NavBar authContext={auth} />
        <Outlet />
        <TanStackRouterDevtools />
      </main>
    </HeroUIProvider>
  );
}
