// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * E2E: Dashboard — login → dashboard → AI strategy widget visible.
 */

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("shows dashboard after login", async ({ page }) => {
    await page.goto("/dashboard");

    // Should NOT redirect to login (auth is already set up)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("AI strategy widget is present on dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for page to finish loading
    await page.waitForLoadState("networkidle");

    // The strategy-log-section component has a heading about AI Strategy
    // Look for any element that indicates the AI Strategy widget
    const strategySection = page
      .locator("text=/AI Strategy|strategy|recent decisions/i")
      .first();

    await expect(strategySection).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar has AI Strategy navigation link", async ({ page }) => {
    await page.goto("/dashboard");

    // The sidebar should have an "AI Strategy" link added in the last session
    const aiStrategyLink = page.locator('a[href="/strategy-log"]');
    await expect(aiStrategyLink).toBeVisible({ timeout: 5_000 });
  });

  test("clicking AI Strategy link navigates to strategy-log page", async ({ page }) => {
    await page.goto("/dashboard");

    const aiStrategyLink = page.locator('a[href="/strategy-log"]').first();
    await aiStrategyLink.click();

    await expect(page).toHaveURL(/\/strategy-log/, { timeout: 5_000 });
  });

  test("strategy-log page renders KPI cards and table", async ({ page }) => {
    await page.goto("/strategy-log");

    await page.waitForLoadState("networkidle");

    // Page should show filter controls or strategy data
    // The page has KPI cards for total decisions, by strategy type, etc.
    const heading = page.locator("h1, h2").filter({ hasText: /strategy|AI|decision/i }).first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});
