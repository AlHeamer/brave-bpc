import { test, expect } from "@playwright/test";

function installWhiteFlashSampler() {
  // Runs in the browser context.
  // Persist via localStorage so a hard navigation (full reload) doesn't lose the signal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;

  const WHITE_RGB = "rgb(255, 255, 255)";
  const WHITE_RGBA = "rgba(255, 255, 255, 1)";

  const storageKey = "pw:sawWhiteFlash";
  if (localStorage.getItem(storageKey) == null) {
    localStorage.setItem(storageKey, "0");
  }

  const isWhite = (color: string | null | undefined) => {
    if (!color) return false;
    const normalized = color.replace(/\s+/g, " ").trim().toLowerCase();
    return normalized === WHITE_RGB || normalized === WHITE_RGBA;
  };

  const sampleOnce = () => {
    if (!document.documentElement || !document.body) {
      requestAnimationFrame(sampleOnce);
      return;
    }

    const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
    const bodyBg = getComputedStyle(document.body).backgroundColor;

    if (isWhite(htmlBg) || isWhite(bodyBg)) {
      localStorage.setItem(storageKey, "1");
      w.__pwWhiteFlash = true;
    }

    requestAnimationFrame(sampleOnce);
  };

  w.__pwWhiteFlash = false;
  requestAnimationFrame(sampleOnce);
}

test.describe("Navbar navigation (dark mode)", () => {
  test("does not flash white during route changes", async ({ page }) => {
    // Force dark mode before any app code runs.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("theme", "dark");
      } catch {
        // ignore (e.g. opaque origin during about:blank)
      }
    });

    // Install background sampler early (and for any hard navigations).
    await page.addInitScript(installWhiteFlashSampler);

    const observedRequests: string[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    page.on("request", (request) => {
      const url = request.url();
      // Keep the log small but useful.
      if (
        url.includes("/session") ||
        url.includes("/logout") ||
        url.includes("/api/") ||
        url.includes("/src/api/")
      ) {
        observedRequests.push(url);
      }
    });

    let sessionHitCount = 0;

    // Mock auth to avoid redirect to backend /login and to show navbar links.
    await page.route(/\/session(\?.*)?$/, async (route) => {
      sessionHitCount += 1;
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

    await page.route(/\/api\/public-config(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          max_request_items: 10,
          homepage_markdown: "# Navbar dark mode test",
        }),
      });
    });

    // Minimal mocks for the pages we navigate across.
    await page.route(/\/api\/blueprints(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            type_name: "Sample Group",
            blueprints: [
              {
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

    await page.route(/\/api\/requisition(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Avoid external image downloads (EVE portraits).
    await page.route("https://images.evetech.net/**", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });

    await page.goto("/list", { waitUntil: "domcontentloaded" });

    expect(page.url()).toMatch(/localhost:4173/);

    // Give the app a moment to mount and call /session.
    await page.waitForTimeout(2_000);

    if (sessionHitCount <= 0) {
      const debugSnapshot = await page.evaluate(() => {
        const root = document.getElementById("root");
        return {
          title: document.title,
          url: window.location.href,
          rootInnerHtml: (root?.innerHTML ?? "").slice(0, 500),
          bodyText: (document.body?.innerText ?? "").slice(0, 500),
        };
      });

      throw new Error(
        `Expected /session to be requested, but it was not.\n\n` +
          `Debug snapshot: ${JSON.stringify(debugSnapshot, null, 2)}\n\n` +
          `Observed requests:\n${observedRequests.join("\n")}\n\n` +
          `Console errors:\n${consoleErrors.join("\n")}\n\n` +
          `Page errors:\n${pageErrors.join("\n")}`,
      );
    }

    // Sanity: we should start in dark mode and not already be white.
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const htmlBg = getComputedStyle(
            document.documentElement,
          ).backgroundColor;
          const bodyBg = getComputedStyle(document.body).backgroundColor;
          return { htmlBg, bodyBg, theme: document.documentElement.className };
        });
      })
      .not.toMatchObject({ htmlBg: "rgb(255, 255, 255)" });

    // Wait for authenticated navbar links.
    const dashboardLink = page.getByRole("link", { name: "Dashboard" });
    const listLink = page.getByRole("link", { name: "List" });
    const requestsLink = page.getByRole("link", { name: "Requests" });

    await expect(dashboardLink).toBeVisible();
    await expect(listLink).toBeVisible();
    await expect(requestsLink).toBeVisible();

    // Navigate via navbar links.
    await expect(page).toHaveURL(/\/list$/);

    await requestsLink.click();
    await expect(page).toHaveURL(/\/requests$/);

    await dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Give a short window for any transient flash to be sampled.
    await page.waitForTimeout(500);

    const sawWhiteFlash = await page.evaluate(() => {
      return localStorage.getItem("pw:sawWhiteFlash") === "1";
    });

    expect(sawWhiteFlash).toBe(false);
  });
});
