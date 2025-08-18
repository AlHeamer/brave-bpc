import { HeroUIProvider, Spinner, ToastProvider } from "@heroui/react";
import {
  createRouter,
  ErrorComponent,
  RouterProvider,
} from "@tanstack/react-router";
import { useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
  routeTree,
  defaultPendingComponent: () => (
    <div className={`p-2 text-2xl`}>
      <Spinner />
    </div>
  ),
  defaultErrorComponent: ({ error }) => <ErrorComponent error={error} />,
  context: {
    auth: undefined!, // This will be set after we wrap the app in an AuthProvider
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  return (
    <HeroUIProvider
      navigate={(to, options) => router.navigate({ to, ...options })}
      useHref={(to) => router.buildLocation({ to }).href}
    >
      {typeof window !== "undefined" && <ToastProvider />}
      <ThemeProvider>
        <RouterProvider router={router} context={{ auth }} />
        {children}
      </ThemeProvider>
    </HeroUIProvider>
  );
}
