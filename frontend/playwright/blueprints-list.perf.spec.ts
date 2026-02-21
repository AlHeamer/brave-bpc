import { test, expect } from "@playwright/test";
import {
  makeBlueprintFixtureSeed,
  type RawBlueprint,
  type RawBlueprintGroup,
} from "../src/test/fixtures/blueprints";

function loadBlueprintFixture(): RawBlueprintGroup[] {
  return makeBlueprintFixtureSeed();
}

function buildGroupedBlueprints(
  seed: RawBlueprintGroup[],
  targetGroups: number,
  options?: {
    minPerGroup?: number;
    maxPerGroup?: number;
  },
): RawBlueprintGroup[] {
  const minPerGroup = Math.max(2, options?.minPerGroup ?? 2);
  const maxPerGroup = Math.max(minPerGroup, options?.maxPerGroup ?? 5);

  const expandableSeed = seed.filter((g) => (g.blueprints?.length ?? 0) >= 2);
  const pool = expandableSeed.length ? expandableSeed : seed;
  if (pool.length === 0) return [];

  const out: RawBlueprintGroup[] = [];
  for (let groupIndex = 0; groupIndex < targetGroups; groupIndex++) {
    const group = pool[groupIndex % pool.length]!;
    const typeName = `${group.type_name} #${groupIndex + 1}`;

    const desired =
      minPerGroup + ((groupIndex * 7) % (maxPerGroup - minPerGroup + 1));
    const blueprints: RawBlueprint[] = [];

    for (let blueprintIndex = 0; blueprintIndex < desired; blueprintIndex++) {
      const bp = group.blueprints[blueprintIndex % group.blueprints.length]!;
      // Ensure unique row identity in the UI.
      // The app derives a stable `key` from (type_id, me, te, runs).
      const uniqueTypeId = bp.type_id + groupIndex * 1000 + blueprintIndex;
      blueprints.push({ ...bp, type_id: uniqueTypeId });
    }

    out.push({ type_name: typeName, blueprints });
  }

  return out;
}

test.describe("Blueprint list page (browser perf/usability)", () => {
  test("loads large dataset and stays interactive (filter/select/scroll)", async ({
    page,
  }) => {
    test.setTimeout(5 * 60 * 1000);

    const seed = loadBlueprintFixture();
    // Keep the perf dataset bounded so the test is representative but stable.
    // 6000 groups × 2 blueprints/group × (seed quantities) => up to ~40,000 total copies.
    const requestedGroups = Number.parseInt(
      process.env.E2E_GROUPS ?? "6000",
      10,
    );
    const groupCount = Math.min(
      Number.isFinite(requestedGroups) ? requestedGroups : 6000,
      6000,
    );

    // Build many expandable groups (like real fixture data)
    const payload = buildGroupedBlueprints(seed, groupCount, {
      minPerGroup: 2,
      // Keep per-group row count fixed so "copies" scale via quantity aggregation,
      // not via an explosion of rows.
      maxPerGroup: 2,
    });

    // Mock auth to avoid redirect to backend /login
    await page.route("**/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          character_name: "Playwright Test",
          auth_level: 99,
          character_id: 123,
        }),
      });
    });

    // Mock the blueprint API response
    await page.route("**/api/blueprints", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });

    // Avoid external image downloads affecting perf numbers.
    await page.route("https://images.evetech.net/**", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });

    const t0 = Date.now();
    await page.goto("/list", { waitUntil: "domcontentloaded" });

    const grid = page.getByRole("grid", {
      name: "Collapsible selectable table",
    });
    await expect(grid).toBeVisible();

    // Wait until at least one row is rendered.
    // With grouped payloads, the initial visible rows are group headers.
    const firstRowHeader = grid.getByRole("rowheader").first();
    await expect(firstRowHeader).toBeVisible({ timeout: 240_000 });
    const t1 = Date.now();

    // eslint-disable-next-line no-console
    console.info(
      `[pw-perf] initial visible: ${t1 - t0}ms for ${payload.length} groups`,
    );

    // Try to GC before sampling heap to get a more meaningful "live" number.
    // (Only works in Chromium; ignored elsewhere.)
    try {
      const client = await page.context().newCDPSession(page);
      await client.send("HeapProfiler.collectGarbage");
    } catch {
      // ignore
    }

    const usedJsHeap = await page.evaluate(() => {
      // Chromium only
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mem = (performance as any).memory;
      return mem?.usedJSHeapSize ?? null;
    });

    if (typeof usedJsHeap === "number") {
      // eslint-disable-next-line no-console
      console.info(
        `[pw-perf] usedJSHeapSize: ${Math.round(usedJsHeap / 1024 / 1024)}MB`,
      );
    }

    // Filter interaction (use visible data for a robust term)
    const searchInput = page.getByPlaceholder("Search items...");
    const headerText = ((await firstRowHeader.textContent()) ?? "").trim();
    const filterTerm =
      headerText.length > 0 ? headerText.slice(0, 12) : "Blueprint";
    const tFilter0 = Date.now();
    await searchInput.fill(filterTerm);
    await expect(grid.getByRole("rowheader").first()).toBeVisible({
      timeout: 240_000,
    });
    const tFilter1 = Date.now();
    // eslint-disable-next-line no-console
    console.info(`[pw-perf] filter: ${tFilter1 - tFilter0}ms`);

    // Search should support a no-results state.
    await searchInput.fill("zzzz-no-matches-expected");
    await expect(grid.getByText("No data")).toBeVisible({ timeout: 60_000 });
    await searchInput.fill(filterTerm);
    await expect(grid.getByRole("rowheader").first()).toBeVisible({
      timeout: 240_000,
    });

    // Scroll the scroll container (real browser)
    {
      const scroller = grid.locator(
        'xpath=ancestor::div[contains(@class,"overflow-auto")][1]',
      );
      await scroller.evaluate((el) => {
        (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
      });

      // Sanity: still interactive after scroll
      await searchInput.press("Control+A");
      await searchInput.type("Rocket");
      await expect(page.getByText(/Rocket/i).first()).toBeVisible();
    }

    // Phase 2: selection + removal (start from clean slate)
    await page.goto("/list", { waitUntil: "domcontentloaded" });

    const grid2 = page.getByRole("grid", {
      name: "Collapsible selectable table",
    });
    await expect(grid2).toBeVisible();
    await expect(grid2.getByRole("rowheader").first()).toBeVisible({
      timeout: 240_000,
    });

    // Expand one group header (required for grouped payloads to reveal checkboxes)
    const expandHint = grid2.getByText(/Click to expand/i).first();
    await expect(expandHint).toBeVisible({ timeout: 60_000 });
    await expandHint.click();
    await expect(grid2.getByText(/Click to collapse/i).first()).toBeVisible({
      timeout: 60_000,
    });

    // Wait for a checkbox from the expanded detail rows, then select it.
    const firstCheckbox = grid2.getByRole("checkbox").first();
    await expect(firstCheckbox).toBeVisible({ timeout: 60_000 });
    await firstCheckbox.click();

    const selectedGrid = page.getByRole("grid", {
      name: "Selected items table",
    });
    await expect(selectedGrid.getByRole("rowheader").first()).toBeVisible({
      timeout: 60_000,
    });

    // Multiple selection should work.
    const secondCheckbox = grid2.getByRole("checkbox").nth(1);
    await expect(secondCheckbox).toBeVisible({ timeout: 60_000 });
    await secondCheckbox.click();

    // Selected grid should now contain at least 2 selected rows.
    await expect(selectedGrid.getByRole("rowheader")).toHaveCount(2, {
      timeout: 60_000,
    });

    // Deselect should remove items from selected items.
    await firstCheckbox.click();
    await expect(selectedGrid.getByRole("rowheader")).toHaveCount(1, {
      timeout: 60_000,
    });

    // Re-select to keep state consistent for later steps.
    await firstCheckbox.click();
    await expect(selectedGrid.getByRole("rowheader")).toHaveCount(2, {
      timeout: 60_000,
    });

    // Phase 3: max-total toast (start from clean slate)
    await page.goto("/list", { waitUntil: "domcontentloaded" });

    const grid3 = page.getByRole("grid", {
      name: "Collapsible selectable table",
    });
    await expect(grid3).toBeVisible();
    await expect(grid3.getByRole("rowheader").first()).toBeVisible({
      timeout: 240_000,
    });

    // Notification upon reaching max total.
    // The page enforces MAX_TOTAL=10 total quantity; default is 1 per selection.
    // Expand more groups until we have at least 11 checkboxes available.
    for (let i = 0; i < 20; i++) {
      const checkboxCount = await grid3.getByRole("checkbox").count();
      if (checkboxCount >= 11) break;

      const nextExpand = grid3.getByText(/Click to expand/i).first();
      if (!(await nextExpand.isVisible())) break;
      await nextExpand.click();
      await expect(grid3.getByText(/Click to collapse/i).first()).toBeVisible({
        timeout: 60_000,
      });
    }

    // Select up to 10 items.
    {
      const target = 10;
      const selectedHeaders = selectedGrid.getByRole("rowheader");

      // In a virtualized table, nth(i) can become unstable across re-renders.
      // Always click an unchecked box and wait for the selected list to grow.
      for (let selectedCount = 0; selectedCount < target; selectedCount++) {
        const unchecked = grid3.getByRole("checkbox", { checked: false });
        await expect
          .poll(async () => await unchecked.count(), { timeout: 60_000 })
          .toBeGreaterThan(0);

        await unchecked.first().click();

        await expect(selectedHeaders).toHaveCount(selectedCount + 1, {
          timeout: 60_000,
        });
      }

      await expect(selectedHeaders).toHaveCount(target, { timeout: 60_000 });
    }

    // Attempting to exceed should show a toast and not increase selection.
    {
      const before = await selectedGrid.getByRole("rowheader").count();
      const checkboxCount = await grid3.getByRole("checkbox").count();
      if (checkboxCount > 0) {
        await grid3
          .getByRole("checkbox")
          .nth(checkboxCount - 1)
          .click();
      }

      await expect(page.getByText(/Selection limit exceeded/i)).toBeVisible({
        timeout: 60_000,
      });
      await expect(selectedGrid.getByRole("rowheader")).toHaveCount(before, {
        timeout: 60_000,
      });
    }

    // Phase 4: item quantity limits (start from clean slate)
    await page.goto("/list", { waitUntil: "domcontentloaded" });

    const grid4 = page.getByRole("grid", {
      name: "Collapsible selectable table",
    });
    await expect(grid4).toBeVisible();
    await expect(grid4.getByRole("rowheader").first()).toBeVisible({
      timeout: 240_000,
    });

    // With sorting + virtualization, the target group header may not be
    // mounted in the DOM until it is within the visible window.
    // Filter down to make it deterministic.
    const searchBox4 = page.getByRole("textbox", { name: "Search items" });
    await expect(searchBox4).toBeVisible({ timeout: 60_000 });
    await searchBox4.fill("Nanite Repair Paste Blueprint");

    // Per-item max clamp (inventory limit) without hitting MAX_TOTAL.
    // The Playwright payload is built from expandable seed groups; Nanite has max quantity 3.
    {
      const naniteHeader = grid4
        .getByRole("rowheader", { name: /Nanite Repair Paste Blueprint/i })
        .first();
      await expect(naniteHeader).toBeVisible({ timeout: 60_000 });
      await naniteHeader.click();

      const naniteHeaderRow = naniteHeader.locator("xpath=ancestor::tr[1]");
      const rowA = naniteHeaderRow.locator("xpath=following-sibling::tr[1]");

      const cbA = rowA.getByRole("checkbox");
      await expect(cbA).toBeVisible({ timeout: 60_000 });
      await cbA.click();

      await expect(selectedGrid.getByRole("rowheader")).toHaveCount(1, {
        timeout: 60_000,
      });

      const incA = rowA
        .getByRole("button", { name: /Increase Adjust quantity for/i })
        .first();
      const decA = rowA
        .getByRole("button", { name: /Decrease Adjust quantity for/i })
        .first();
      await expect(incA).toBeVisible({ timeout: 60_000 });
      await expect(decA).toBeVisible({ timeout: 60_000 });

      const selectedQtyCell = selectedGrid
        .getByRole("row")
        .nth(1)
        .getByRole("gridcell")
        // Column order in Selected Items: ME, TE, Runs, Quantity, Remove
        .nth(3);

      await expect(decA).toBeDisabled({ timeout: 60_000 });
      await expect(selectedQtyCell).toHaveText("1", { timeout: 60_000 });

      // Increase from 1 -> 3 (max), then ensure it cannot go higher.
      await incA.click();
      await incA.click();
      await expect(selectedQtyCell).toHaveText("3", { timeout: 60_000 });
      await expect(incA).toBeDisabled({ timeout: 60_000 });
    }

    // MAX_TOTAL enforcement via quantity adjustment (start from clean slate).
    await page.goto("/list", { waitUntil: "domcontentloaded" });

    const grid4b = page.getByRole("grid", {
      name: "Collapsible selectable table",
    });
    await expect(grid4b).toBeVisible();
    await expect(grid4b.getByRole("rowheader").first()).toBeVisible({
      timeout: 240_000,
    });

    const searchBox4b = page.getByRole("textbox", { name: "Search items" });
    await expect(searchBox4b).toBeVisible({ timeout: 60_000 });
    await searchBox4b.fill("Rocket Fuel Blueprint");

    // Use a deterministic expandable group that contains at least two items.
    const rocketHeader = grid4b
      .getByRole("rowheader", { name: /Rocket Fuel Blueprint/i })
      .first();
    await expect(rocketHeader).toBeVisible({ timeout: 60_000 });
    await rocketHeader.click();

    const rocketHeaderRow = rocketHeader.locator("xpath=ancestor::tr[1]");
    const rowA = rocketHeaderRow.locator("xpath=following-sibling::tr[1]");
    const rowB = rocketHeaderRow.locator("xpath=following-sibling::tr[2]");

    const cbA = rowA.getByRole("checkbox");
    const cbB = rowB.getByRole("checkbox");
    await expect(cbA).toBeVisible({ timeout: 60_000 });
    await expect(cbB).toBeVisible({ timeout: 60_000 });

    await cbA.click();
    await expect(selectedGrid.getByRole("rowheader")).toHaveCount(1, {
      timeout: 60_000,
    });

    const incA = rowA
      .getByRole("button", { name: /Increase Adjust quantity for/i })
      .first();
    const decA = rowA
      .getByRole("button", { name: /Decrease Adjust quantity for/i })
      .first();
    await expect(incA).toBeVisible({ timeout: 60_000 });
    await expect(decA).toBeVisible({ timeout: 60_000 });

    const selectedQtyCellA = selectedGrid
      .getByRole("row")
      .nth(1)
      .getByRole("gridcell")
      .nth(3);

    // Set A to 9.
    for (let i = 0; i < 8; i++) {
      await incA.click();
    }
    await expect(selectedQtyCellA).toHaveText("9", { timeout: 60_000 });

    // Select B (default quantity 1), then try to increase it to 2 => total 11.
    await cbB.click();
    await expect(selectedGrid.getByRole("rowheader")).toHaveCount(2, {
      timeout: 60_000,
    });

    const incB = rowB
      .getByRole("button", { name: /Increase Adjust quantity for/i })
      .first();
    await expect(incB).toBeVisible({ timeout: 60_000 });
    await incB.click();

    await expect(page.getByText(/Selection limit exceeded/i)).toBeVisible({
      timeout: 60_000,
    });

    const selectedQtyCellB = selectedGrid
      .getByRole("row")
      .nth(2)
      .getByRole("gridcell")
      .nth(3);
    await expect(selectedQtyCellB).toHaveText("1", { timeout: 60_000 });
  });
});
