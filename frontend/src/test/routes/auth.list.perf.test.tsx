import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import RouteComponent from "../../routes/_auth.list";
import {
  buildSingleBlueprintGroups,
  loadTestBlueprintGroups,
  pickExpandableSeedGroup,
} from "../fixtures/blueprints";

const runLocalPerf = process.env.RUN_LOCAL_PERF_TESTS === "1";
const describePerf = runLocalPerf ? describe : describe.skip;

const FIND_TIMEOUT_MS = 60_000;

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

describePerf("Blueprint list page (local perf/usability)", () => {
  const seed = loadTestBlueprintGroups();
  // Default kept intentionally modest so the suite is usable.
  // Override locally (e.g. 20000) to stress-test.
  const targetGroups = Number.parseInt(process.env.PERF_GROUPS ?? "2000", 10);

  it("initial render with large dataset (prints timing)", async () => {
    const large = buildSingleBlueprintGroups(seed, targetGroups);
    const expandable = pickExpandableSeedGroup(seed);
    const payload = expandable ? [expandable, ...large] : large;

    server.use(
      http.get("/api/blueprints", () => {
        return HttpResponse.json(payload);
      }),
    );

    const t0 = performance.now();
    renderWithQueryClient(<RouteComponent />);

    await screen.findAllByText(/Antimatter Charge S Blueprint/i, undefined, {
      timeout: FIND_TIMEOUT_MS,
    });
    const t1 = performance.now();

    // eslint-disable-next-line no-console
    console.info(
      `[perf] initial render: ${Math.round(t1 - t0)}ms for ${payload.length} groups`,
    );

    expect(true).toBe(true);
  }, 120_000);

  it("filtering remains usable (prints timing)", async () => {
    const large = buildSingleBlueprintGroups(
      seed,
      Math.min(targetGroups, 5000),
    );
    server.use(
      http.get("/api/blueprints", () => {
        return HttpResponse.json(large);
      }),
    );

    renderWithQueryClient(<RouteComponent />);
    await screen.findAllByText(/Antimatter Charge S Blueprint/i, undefined, {
      timeout: FIND_TIMEOUT_MS,
    });

    const input = screen.getByPlaceholderText(/Search items/i);
    const user = userEvent.setup();

    const t0 = performance.now();
    await user.clear(input);
    await user.type(input, "Antimatter");

    await screen.findAllByText(/Antimatter/i, undefined, {
      timeout: FIND_TIMEOUT_MS,
    });
    const t1 = performance.now();

    // eslint-disable-next-line no-console
    console.info(`[perf] filter interaction: ${Math.round(t1 - t0)}ms`);

    expect(true).toBe(true);
  }, 120_000);

  it("selecting an item works after filtering", async () => {
    const large = buildSingleBlueprintGroups(
      seed,
      Math.min(targetGroups, 2000),
    );
    server.use(
      http.get("/api/blueprints", () => {
        return HttpResponse.json(large);
      }),
    );

    renderWithQueryClient(<RouteComponent />);
    await screen.findAllByText(/Antimatter Charge S Blueprint/i, undefined, {
      timeout: FIND_TIMEOUT_MS,
    });

    const input = screen.getByPlaceholderText(/Search items/i);
    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "Antimatter");

    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);

    await user.click(checkboxes[0]!);
    expect(checkboxes[0]).toBeChecked();
  }, 120_000);

  it("expanding/collapsing a multi-blueprint group works", async () => {
    const expandable = pickExpandableSeedGroup(seed);
    if (!expandable) {
      expect(true).toBe(true);
      return;
    }

    server.use(
      http.get("/api/blueprints", () => {
        return HttpResponse.json([expandable]);
      }),
    );

    renderWithQueryClient(<RouteComponent />);

    const expandHint = await screen.findByText(/Click to expand/i);
    const user = userEvent.setup();
    await user.click(expandHint);

    expect(await screen.findByText(/Click to collapse/i)).toBeInTheDocument();

    const table = screen.getByRole("grid", {
      name: /Collapsible selectable table/i,
    });
    fireEvent.scroll(table);
  }, 120_000);
});
