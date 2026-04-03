import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import type { AppConfig } from "../../api/config";
import RouteComponent from "../../routes/_auth.admin";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
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

describe("Admin page", () => {
  it("loads and saves the backend config", async () => {
    const user = userEvent.setup();
    let savedConfig: AppConfig | undefined;

    server.use(
      http.get("/api/config", () => {
        return HttpResponse.json({
          alliances: [99003214],
          corporations: [98000001],
          admin_corp: 98544197,
          admin_char: 95154016,
          max_contracts: 2,
          max_request_items: 10,
          homepage_markdown: "# Existing homepage\n\nCurrent copy",
        } satisfies AppConfig);
      }),
      http.post("/api/config", async ({ request }) => {
        savedConfig = (await request.json()) as AppConfig;
        return HttpResponse.json(savedConfig);
      }),
    );

    renderWithProviders(<RouteComponent />);

    expect(await screen.findByDisplayValue("98544197")).toBeInTheDocument();

    const maxRequestItems = screen.getByLabelText(/Max request items/i);
    await user.clear(maxRequestItems);
    await user.type(maxRequestItems, "12");

    const markdownField = screen.getByLabelText(/Homepage markdown/i);
    await user.clear(markdownField);
    await user.type(markdownField, "# Updated homepage{enter}{enter}New copy");

    const scopeLink = screen.getByRole("button", {
      name: /Grant Required Scopes/i,
    });
    expect(scopeLink.getAttribute("href")).toContain("/login/scope?src=");

    await user.click(screen.getByRole("button", { name: /Save settings/i }));

    await waitFor(() => {
      expect(savedConfig).toMatchObject({
        max_request_items: 12,
        homepage_markdown: "# Updated homepage\n\nNew copy",
      });
    });
  });
});
