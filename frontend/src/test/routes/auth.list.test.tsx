import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import RouteComponent from "../../routes/_auth.list";

function renderWithQueryClient(ui: React.ReactElement) {
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

function getCheckboxInput(element: HTMLElement) {
  return (
    (element.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null) ?? element
  );
}

describe("Blueprint list page", () => {
  it("renders blueprint groups from mocked /api/blueprints", async () => {
    renderWithQueryClient(<RouteComponent />);

    // Comes from the deterministic fixture seed (served by MSW handler).
    expect(
      await screen.findByText(/Antimatter Charge S Blueprint/i),
    ).toBeInTheDocument();
  });

  it("allows selecting an item and shows quantity adjuster", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<RouteComponent />);

    // Wait for at least one seeded group to render.
    const firstTypeName = await screen.findByText(
      /Antimatter Charge S Blueprint/i,
    );
    expect(firstTypeName).toBeInTheDocument();

    // Expand if needed (seed includes expandable groups).
    const expandHints = screen.queryAllByText(/Click to expand/i);
    if (expandHints.length > 0) {
      await user.click(expandHints[0]!);
      expect(await screen.findByText(/Click to collapse/i)).toBeInTheDocument();
    }

    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);

    const checkboxRoot = checkboxes[0]! as unknown as HTMLElement;
    const checkboxInput =
      (checkboxRoot.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement | null) ?? checkboxRoot;

    await user.click(checkboxInput);

    const selectedGrid = await screen.findByRole("grid", {
      name: /Selected items table/i,
    });
    expect(selectedGrid).toBeInTheDocument();
  });

  it("uses MAX_REQUEST_ITEMS from public config", async () => {
    const user = userEvent.setup();

    server.use(
      http.get("/api/public-config", () => {
        return HttpResponse.json({
          max_request_items: 1,
          homepage_markdown: "",
        });
      }),
      http.get("/api/blueprints", () => {
        return HttpResponse.json([
          {
            type_name: "Test Group",
            blueprints: [
              {
                quantity: 1,
                runs: 10,
                type_id: 9001,
                material_efficiency: 10,
                time_efficiency: 20,
              },
              {
                quantity: 1,
                runs: 5,
                type_id: 9002,
                material_efficiency: 8,
                time_efficiency: 12,
              },
            ],
          },
        ]);
      }),
    );

    renderWithQueryClient(<RouteComponent />);

    expect(await screen.findByText(/Test Group/i)).toBeInTheDocument();

    const expandHints = screen.queryAllByText(/Click to expand/i);
    if (expandHints.length > 0) {
      await user.click(expandHints[0]!);
    }

    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);

    await user.click(
      getCheckboxInput(checkboxes[0]! as unknown as HTMLElement),
    );

    const selectedGrid = await screen.findByRole("grid", {
      name: /Selected items table/i,
    });

    await waitFor(() => {
      expect(within(selectedGrid).getAllByRole("rowheader")).toHaveLength(1);
    });

    await user.click(
      getCheckboxInput(checkboxes[1]! as unknown as HTMLElement),
    );

    await waitFor(() => {
      expect(within(selectedGrid).getAllByRole("rowheader")).toHaveLength(1);
    });
  });
});
