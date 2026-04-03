import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import RouteComponent from "../../routes/index";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={() => undefined} useHref={() => "#"}>
        <ToastProvider />
        {ui}
      </HeroUIProvider>
    </QueryClientProvider>,
  );
}

describe("Public homepage", () => {
  it("renders homepage markdown from public config", async () => {
    renderWithProviders(<RouteComponent />);

    expect(
      await screen.findByRole("heading", {
        name: /Welcome to Brave's BPC Request Program!/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/10 maximum items per request/i),
    ).toBeInTheDocument();
  });
});
