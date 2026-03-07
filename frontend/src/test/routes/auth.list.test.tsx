import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
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
});
