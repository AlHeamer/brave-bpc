import { expect, test } from "@playwright/test";

type SessionUser = {
  character_name: string;
  auth_level: number;
  character_id: number;
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
  lock?: unknown | null;
  blueprints: Array<{
    type_id: number;
    type_name: string;
    runs: number;
    material_efficiency?: number;
    time_efficiency?: number;
    quantity?: number;
  }>;
};

function makeRequest(id: number): BlueprintRequest {
  const now = "2026-02-21T12:00:00.000Z";
  return {
    id,
    character_id: 123,
    character_name: "Playwright Test",
    status: 1,
    created_at: now,
    updated_at: now,
    updated_by: "Playwright Test",
    public_notes: "",
    lock: null,
    blueprints: [
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

test("Dashboard lists open requisitions using status=1", async ({ page }) => {
  await mockSession(page, {
    character_name: "Playwright Test",
    auth_level: 1,
    character_id: 123,
  });

  const openReqs = [makeRequest(44), makeRequest(45), makeRequest(46)];

  await page.route(/\/api\/requisition(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");

    if (status !== "1") {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          code: 400,
          msg: `unexpected status=${String(status)}`,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(openReqs),
    });
  });

  // Dashboard also loads blueprints for the inventory card.
  await page.route(/\/api\/blueprints(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  const cardHeader = page.getByText("Open Requisitions");
  await expect(cardHeader).toBeVisible();

  await expect(
    page.getByText(String(openReqs.length), { exact: true }),
  ).toBeVisible();
});
