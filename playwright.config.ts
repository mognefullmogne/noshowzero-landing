import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for NoShowZero E2E tests.
 *
 * Tests run against the local dev server (http://localhost:3000).
 * Auth state is set up once and reused across tests via storageState.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,           // keep sequential — shared Supabase DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    // Step 1: authenticate and save session
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Step 2: run all specs with saved auth
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  // Start dev server automatically when not in CI
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
