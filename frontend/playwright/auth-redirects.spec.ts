import { expect, test, type Page, type Route } from "@playwright/test";

function mockLoggedOutSession(page: Page) {
  return page.route(/\/session(\?.*)?$/, async (route: Route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: 401, msg: "unauthorized" }),
    });
  });
}

function mockAuthenticatedSession(page: Page) {
  return page.route(/\/session(\?.*)?$/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        character_name: "Playwright Test",
        auth_level: 3,
        character_id: 123,
      }),
    });
  });
}

function mockBlueprints(page: Page) {
  return page.route(/\/api\/blueprints(\?.*)?$/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          type_name: "Sample Group",
          blueprints: [
            {
              key: "sample-group-1",
              quantity: 1,
              runs: 10,
              type_id: 1234,
              material_efficiency: 10,
              time_efficiency: 20,
            },
          ],
        },
      ]),
    });
  });
}

function mockPublicConfig(page: Page) {
  return page.route(/\/api\/public-config(\?.*)?$/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        max_request_items: 10,
        homepage_markdown:
          "# Welcome to Brave's BPC Request Program!\n\nConfigured homepage copy.",
      }),
    });
  });
}

function mockPortraits(page: Page) {
  return page.route("https://images.evetech.net/**", async (route: Route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

test.describe("Auth redirects", () => {
  test("renders a deployment-safe login CTA on the public page", async ({
    page,
  }) => {
    await mockLoggedOutSession(page);
    await mockPublicConfig(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const loginLink = page.locator('a[href*="/login?src="]').first();
    await expect(loginLink).toBeVisible();

    const href = await loginLink.getAttribute("href");
    expect(href).not.toBeNull();
    expect(href).not.toContain(":2727");

    const loginUrl = new URL(href!, page.url());
    expect(loginUrl.pathname).toBe("/login");
    expect(loginUrl.searchParams.get("src")).toBe("http://localhost:4173/");
  });

  test("redirects unauthenticated protected routes to the home page", async ({
    page,
  }) => {
    await mockLoggedOutSession(page);
    await mockPublicConfig(page);

    await page.goto("/list", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('a[href*="/login?src="]').first()).toBeVisible();
  });

  test("keeps authenticated users on protected routes", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockPublicConfig(page);
    await mockBlueprints(page);
    await mockPortraits(page);

    await page.goto("/list", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/list$/);
    await expect(page.getByText("Playwright Test")).toBeVisible();
    await expect(page.locator("body")).toContainText("Sample Group");
  });

  test("returns to the public page after logout", async ({ page }) => {
    await mockAuthenticatedSession(page);
    await mockPublicConfig(page);
    await mockBlueprints(page);
    await mockPortraits(page);
    await page.route(/\/login(\?.*)?$/, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Unexpected login redirect</body></html>",
      });
    });
    await page.route(/\/logout(\?.*)?$/, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/list", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/list$/);
    await page.getByText("Playwright Test").click();
    await page.getByText("Log Out").click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('a[href*="/login?src="]').first()).toBeVisible();
  });
});
