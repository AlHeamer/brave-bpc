import { Avatar, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, HeroUIProvider, Link, Navbar, NavbarContent, NavbarItem } from "@heroui/react";
import { Outlet, createRootRouteWithContext  } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { AuthContext } from "../contexts/AuthContext";
import { NavBar } from "../components/NavBar";

interface MyRouterContext {
  auth: AuthContext
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div className="flex gap-4">
        <p>Page not found</p>
        <Link showAnchorIcon href="/">Back Home</Link>
      </div>
    )
  },
});

function RootComponent() {
  const {auth} = Route.useRouteContext()
  return (

      <HeroUIProvider>
        <main className="dark text-foreground bg-background">
          <NavBar authContext={auth}/>
          <Outlet />
          <TanStackRouterDevtools />
        </main>
      </HeroUIProvider>

  );
}
