import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./playwright",
  timeout: 5 * 60 * 1000,
  expect: {
    timeout: 60 * 1000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev-local -- --port 4173 --strictPort",
    cwd: frontendDir,
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
