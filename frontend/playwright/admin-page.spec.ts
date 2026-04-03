import { expect, test, type Page, type Route } from "@playwright/test";

type AppConfig = {
  alliances: number[];
  corporations: number[];
  admin_corp: number;
  admin_char: number;
  max_contracts: number;
  max_request_items: number;
  homepage_markdown: string;
};

function mockAdminSession(page: Page) {
  return page.route(/\/session(\?.*)?$/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        character_name: "Playwright Admin",
        auth_level: 3,
        character_id: 123,
      }),
    });
  });
}

function mockPortraits(page: Page) {
  return page.route("https://images.evetech.net/**", async (route: Route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

test.describe("Admin page", () => {
  test("loads config, exposes scope login, and saves changes", async ({
    page,
  }) => {
    let postedConfig: AppConfig | undefined;

    await mockAdminSession(page);
    await mockPortraits(page);
    await page.route(/\/api\/config(\?.*)?$/, async (route: Route) => {
      if (route.request().method() === "POST") {
        postedConfig = (await route.request().postDataJSON()) as AppConfig;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(postedConfig),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          alliances: [99003214],
          corporations: [],
          admin_corp: 98544197,
          admin_char: 95154016,
          max_contracts: 2,
          max_request_items: 10,
          homepage_markdown: "# Existing homepage\n\nCurrent copy",
        } satisfies AppConfig),
      });
    });

    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Administration" }),
    ).toBeVisible();

    const scopeLink = page.getByRole("button", {
      name: /Grant Required Scopes/i,
    });
    await expect(scopeLink).toBeVisible();

    const href = await scopeLink.getAttribute("href");
    expect(href).toBeTruthy();
    const loginUrl = new URL(href!, page.url());
    expect(loginUrl.pathname).toBe("/login/scope");
    expect(loginUrl.searchParams.get("src")).toBe(
      "http://localhost:4173/admin",
    );

    const maxRequestItems = page.getByLabel("Max request items");
    await maxRequestItems.fill("12");

    const markdownField = page.getByLabel("Homepage markdown");
    await markdownField.fill("# Updated homepage\n\nNew copy");

    await page.getByRole("button", { name: /Save settings/i }).click();

    await expect
      .poll(() => postedConfig, { timeout: 10_000 })
      .toMatchObject({
        max_request_items: 12,
        homepage_markdown: "# Updated homepage\n\nNew copy",
      });
  });
});
