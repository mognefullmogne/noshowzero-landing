import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the production visual audit.
 * Runs against the live Vercel deployment.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /visual-audit\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  use: {
    baseURL: "https://noshowzero-landing.vercel.app",
    trace: "off",
    screenshot: "off",
    video: "off",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
