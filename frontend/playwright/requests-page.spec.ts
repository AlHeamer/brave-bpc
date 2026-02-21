import { expect, test } from "@playwright/test";

const UI_TIMEOUT_MS = 5_000;

type SessionUser = {
  character_name: string;
  auth_level: number;
  character_id: number;
};

type RequisitionLock = {
  locked_at: string;
  character_id: number;
  character_name: string;
};

type BlueprintLineItem = {
  type_id: number;
  type_name: string;
  runs: number;
  material_efficiency?: number;
  time_efficiency?: number;
  quantity?: number;
};

type BlueprintRequest = {
  id: number;
  character_id: number;
  character_name: string;
  status?: number | string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
  public_notes?: string;
  lock?: RequisitionLock | null;
  blueprints: BlueprintLineItem[];
};

function makeRequest(
  partial: Partial<BlueprintRequest> & { id: number },
): BlueprintRequest {
  const now = "2026-02-21T12:00:00.000Z";

  return {
    id: partial.id,
    character_id: partial.character_id ?? 123,
    character_name: partial.character_name ?? "Playwright Test",
    status: partial.status ?? 1,
    created_at: partial.created_at ?? now,
    updated_at: partial.updated_at ?? now,
    updated_by: partial.updated_by ?? "Playwright Test",
    public_notes: partial.public_notes ?? "",
    lock: partial.lock ?? null,
    blueprints: partial.blueprints ?? [
      {
        type_id: 1234,
        type_name: "Arbitrator Blueprint",
        runs: 10,
        material_efficiency: 10,
        time_efficiency: 20,
        quantity: 1,
      },
    ],
  };
}

async function mockSession(
  page: import("@playwright/test").Page,
  user: SessionUser,
) {
  await page.route(/\/session(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });
}

async function mockRequisitions(
  page: import("@playwright/test").Page,
  handler: (status: number) => BlueprintRequest[],
) {
  await page.route(/\/api\/requisition(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus == null ? 0 : Number(rawStatus);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(handler(Number.isFinite(status) ? status : 0)),
    });
  });
}

async function blockEveImages(page: import("@playwright/test").Page) {
  await page.route("https://images.evetech.net/**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

async function gotoRequests(page: import("@playwright/test").Page) {
  await page.goto("/requests", { waitUntil: "domcontentloaded" });
  const requestsGrid = page.getByRole("grid", { name: "Requests Table" });
  await expect(requestsGrid).toBeVisible({ timeout: UI_TIMEOUT_MS });
  return requestsGrid;
}

test.describe("Requests page", () => {
  test.describe.configure({ mode: "parallel" });

  test("'Viewing' label works for other-user requests (member)", async ({
    page,
  }) => {
    await mockSession(page, {
      character_name: "Playwright Test",
      auth_level: 1,
      character_id: 123,
    });

    const req44 = makeRequest({
      id: 44,
      character_id: 123,
      character_name: "Playwright Test",
      status: 1,
    });
    const req45 = makeRequest({
      id: 45,
      character_id: 999,
      character_name: "Ren Caderu",
      status: 1,
    });

    await mockRequisitions(page, () => [req44, req45]);
    await blockEveImages(page);

    const requestsGrid = await gotoRequests(page);
    const row44 = requestsGrid.getByRole("row", { name: /\b44\b/ });
    const row45 = requestsGrid.getByRole("row", { name: /\b45\b/ });

    await row45.getByRole("button", { name: "View" }).click();
    await expect(row45.getByRole("button", { name: "Viewing" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByText("Request #45 details")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    await expect(row44.getByRole("button", { name: "View" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
  });

  test("'Viewing' label works for other-user lockable requests (admin)", async ({
    page,
  }) => {
    await mockSession(page, {
      character_name: "Playwright Test",
      auth_level: 99,
      character_id: 123,
    });

    const req44 = makeRequest({
      id: 44,
      character_id: 123,
      character_name: "Playwright Test",
      status: 1,
    });
    const req45 = makeRequest({
      id: 45,
      character_id: 999,
      character_name: "Ren Caderu",
      status: 1,
    });

    await mockRequisitions(page, () => [req44, req45]);
    await blockEveImages(page);

    // Admin selection attempts to acquire a lock for open requests.
    await page.route(
      /\/api\/requisition\/(\d+)\/lock(\?.*)?$/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        });
      },
    );
    await page.route(
      /\/api\/requisition\/(\d+)\/unlock(\?.*)?$/,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        });
      },
    );

    const requestsGrid = await gotoRequests(page);
    const row45 = requestsGrid.getByRole("row", { name: /\b45\b/ });

    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/requisition/45/lock") &&
          resp.status() === 200,
        { timeout: UI_TIMEOUT_MS },
      ),
      row45.getByRole("button", { name: "View" }).click(),
    ]);

    await expect(row45.getByRole("button", { name: "Viewing" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByText("Request #45 details")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
  });

  test("switching between requests moves 'Viewing' button text", async ({
    page,
  }) => {
    await mockSession(page, {
      character_name: "Playwright Test",
      auth_level: 1,
      character_id: 123,
    });

    const req44 = makeRequest({
      id: 44,
      character_id: 123,
      character_name: "Playwright Test",
      status: 1,
    });
    const req45 = makeRequest({
      id: 45,
      character_id: 999,
      character_name: "Ren Caderu",
      status: 4,
    });

    await mockRequisitions(page, () => [req44, req45]);
    await blockEveImages(page);

    const requestsGrid = await gotoRequests(page);
    const row44 = requestsGrid.getByRole("row", { name: /\b44\b/ });
    const row45 = requestsGrid.getByRole("row", { name: /\b45\b/ });

    await row44.getByRole("button", { name: "View" }).click();
    await expect(row44.getByRole("button", { name: "Viewing" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByText("Request #44 details")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    await row45.getByRole("button", { name: "View" }).click();
    await expect(row45.getByRole("button", { name: "Viewing" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByText("Request #45 details")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    // Previously-viewed row should revert.
    await expect(row44.getByRole("button", { name: "View" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
  });

  test("admin direct switch releases lock then locks new request", async ({
    page,
  }) => {
    await mockSession(page, {
      character_name: "Playwright Test",
      auth_level: 99,
      character_id: 123,
    });

    const req44 = makeRequest({
      id: 44,
      character_id: 123,
      character_name: "Playwright Test",
      status: 1,
    });
    const req45 = makeRequest({
      id: 45,
      character_id: 999,
      character_name: "Ren Caderu",
      status: 1,
    });

    await mockRequisitions(page, () => [req44, req45]);
    await blockEveImages(page);

    const lockCalls: number[] = [];
    const unlockCalls: number[] = [];

    await page.route(
      /\/api\/requisition\/(\d+)\/lock(\?.*)?$/,
      async (route) => {
        const m = route
          .request()
          .url()
          .match(/\/api\/requisition\/(\d+)\/lock/);
        if (m?.[1]) lockCalls.push(Number(m[1]));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        });
      },
    );

    await page.route(
      /\/api\/requisition\/(\d+)\/unlock(\?.*)?$/,
      async (route) => {
        const m = route
          .request()
          .url()
          .match(/\/api\/requisition\/(\d+)\/unlock/);
        if (m?.[1]) unlockCalls.push(Number(m[1]));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        });
      },
    );

    const requestsGrid = await gotoRequests(page);
    const row44 = requestsGrid.getByRole("row", { name: /\b44\b/ });
    const row45 = requestsGrid.getByRole("row", { name: /\b45\b/ });

    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/requisition/44/lock") &&
          resp.status() === 200,
        { timeout: UI_TIMEOUT_MS },
      ),
      row44.getByRole("button", { name: "View" }).click(),
    ]);
    await expect
      .poll(() => lockCalls, { timeout: UI_TIMEOUT_MS })
      .toEqual([44]);
    await expect(page.getByText("Request #44 details")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    // Direct switch should unlock the previous request then lock the new one.
    await expect(row45.getByRole("button", { name: "View" })).toBeEnabled({
      timeout: UI_TIMEOUT_MS,
    });

    await Promise.all([
      page.waitForRequest(
        (req) =>
          req.method() === "PATCH" &&
          req.url().includes("/api/requisition/44/unlock"),
        { timeout: UI_TIMEOUT_MS },
      ),
      page.waitForRequest(
        (req) =>
          req.method() === "PATCH" &&
          req.url().includes("/api/requisition/45/lock"),
        { timeout: UI_TIMEOUT_MS },
      ),
      row45.getByRole("button", { name: "View" }).click(),
    ]);

    await expect
      .poll(() => unlockCalls, { timeout: UI_TIMEOUT_MS })
      .toEqual([44]);
    await expect
      .poll(() => lockCalls, { timeout: UI_TIMEOUT_MS })
      .toEqual([44, 45]);
    await expect(page.getByText("Request #45 details")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
  });

  test("highlights viewed row and shows 'Viewing'", async ({ page }) => {
    await mockSession(page, {
      character_name: "Playwright Test",
      auth_level: 1,
      character_id: 123,
    });

    const req44 = makeRequest({
      id: 44,
      character_id: 123,
      character_name: "Playwright Test",
      status: 1,
    });
    const req41 = makeRequest({
      id: 41,
      character_id: 999,
      character_name: "Ren Caderu",
      status: 4,
    });

    await mockRequisitions(page, () => [req44, req41]);
    await blockEveImages(page);

    const requestsTable = await gotoRequests(page);

    const row44 = requestsTable.getByRole("row", { name: /\b44\b/ });
    await expect(row44).toBeVisible();

    await row44.getByRole("button", { name: "View" }).click();

    // Row-level highlight is driven by selection attributes + CSS.
    await expect(row44).toHaveAttribute("data-selected", "true", {
      timeout: UI_TIMEOUT_MS,
    });

    // The action button should reflect the viewed state.
    await expect(row44.getByRole("button", { name: "Viewing" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    // Details panel shows the request.
    await expect(page.getByText("Request #44 details")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
  });

  test("admin role locks on view and unlocks on close", async ({ page }) => {
    await mockSession(page, {
      character_name: "Playwright Test",
      auth_level: 99,
      character_id: 123,
    });

    const req44 = makeRequest({
      id: 44,
      character_id: 123,
      character_name: "Playwright Test",
      status: 1,
    });

    await mockRequisitions(page, () => [req44]);
    await blockEveImages(page);

    let lockCalls = 0;
    let unlockCalls = 0;

    await page.route(/\/api\/requisition\/(\d+)\/lock$/, async (route) => {
      lockCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await page.route(/\/api\/requisition\/(\d+)\/unlock$/, async (route) => {
      unlockCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    const requestsTable = await gotoRequests(page);
    const row44 = requestsTable.getByRole("row", { name: /\b44\b/ });

    await row44.getByRole("button", { name: "View" }).click();

    await expect.poll(() => lockCalls, { timeout: UI_TIMEOUT_MS }).toBe(1);
    await expect(page.getByText("Request #44 details")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    await page.getByRole("button", { name: "Close" }).click();

    await expect.poll(() => unlockCalls, { timeout: UI_TIMEOUT_MS }).toBe(1);
  });

  test("shows correct action buttons by role", async ({ page }) => {
    // Non-admin: can cancel own open requests, but cannot complete/reject.
    await mockSession(page, {
      character_name: "Playwright Test",
      auth_level: 1,
      character_id: 123,
    });

    const ownOpen = makeRequest({
      id: 44,
      character_id: 123,
      character_name: "Playwright Test",
      status: 1,
    });

    await mockRequisitions(page, () => [ownOpen]);
    await blockEveImages(page);

    await gotoRequests(page);
    await page
      .getByRole("row", { name: /\b44\b/ })
      .getByRole("button", { name: "View" })
      .click();

    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByRole("button", { name: "Complete" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);

    // Admin: can complete/reject open requests; cancel still only for own.
    await page.unroute(/\/session(\?.*)?$/);
    await mockSession(page, {
      character_name: "Playwright Test",
      auth_level: 99,
      character_id: 123,
    });

    // Admin selection attempts to acquire a lock for open requests.
    await page.route(/\/api\/requisition\/(\d+)\/lock$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });
    await page.route(/\/api\/requisition\/(\d+)\/unlock$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    // Re-load with admin session.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByRole("row", { name: /\b44\b/ })
      .getByRole("button", { name: "View" })
      .click();

    await expect(page.getByRole("button", { name: "Complete" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByRole("button", { name: "Reject" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
  });

  test("status filtering and character search", async ({ page }) => {
    await mockSession(page, {
      character_name: "Playwright Test",
      auth_level: 1,
      character_id: 123,
    });

    const openA = makeRequest({
      id: 44,
      character_id: 123,
      character_name: "Playwright Test",
      status: 1,
    });
    const openB = makeRequest({
      id: 45,
      character_id: 999,
      character_name: "Ren Caderu",
      status: 1,
    });
    const rejected = makeRequest({
      id: 41,
      character_id: 999,
      character_name: "Ren Caderu",
      status: 4,
    });

    await mockRequisitions(page, (status) => {
      if (status === 1) return [openA, openB];
      if (status === 4) return [rejected];
      return [openA, openB, rejected];
    });

    await blockEveImages(page);

    const requestsTable = await gotoRequests(page);
    await expect(requestsTable.getByText("44")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(requestsTable.getByText("45")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(requestsTable.getByText("41")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    // Filter status to Rejected.
    await page.getByRole("button", { name: /All Status/i }).click();
    await page.getByRole("option", { name: "Rejected" }).click();

    await expect(requestsTable.getByText("41")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(requestsTable.getByText("44")).toHaveCount(0);
    await expect(requestsTable.getByText("45")).toHaveCount(0);

    // Clear filter back to All.
    await page.getByRole("button", { name: /Rejected Status/i }).click();
    await page.getByRole("option", { name: "All" }).click();

    await expect(requestsTable.getByText("44")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(requestsTable.getByText("45")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });

    // Character search (client-side filter).
    await page.getByLabel("Character").fill("Ren");

    await expect(requestsTable.getByText("45")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(requestsTable.getByText("41")).toBeVisible({
      timeout: UI_TIMEOUT_MS,
    });
    await expect(requestsTable.getByText("44")).toHaveCount(0);
  });
});
