// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { test, Page } from "@playwright/test";

const BASE = "https://noshowzero-landing.vercel.app";
const EMAIL = "aimonepitacco@gmail.com";
const PASSWORD = "AuditTest2026x";
const SCREENSHOT_DIR = "/tmp";

async function waitForLoad(page: Page) {
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
}

async function shot(page: Page, filename: string) {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${filename}`,
    fullPage: true,
  });
  console.log(`Screenshot: ${SCREENSHOT_DIR}/${filename}`);
}

async function doLogin(page: Page): Promise<boolean> {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

  // Wait for the form to be hydrated (react-hook-form)
  await page.waitForSelector('input[id="email"]', { timeout: 15_000 });
  await page.waitForTimeout(500); // extra buffer for hydration

  await page.locator('input[id="email"]').fill(EMAIL);
  await page.locator('input[id="password"]').fill(PASSWORD);
  await page.waitForTimeout(300);

  await page.locator('button[type="submit"]').click();

  try {
    await page.waitForURL(/\/(dashboard|app|home)/, { timeout: 20_000 });
    console.log("Login SUCCESS — URL:", page.url());
    return true;
  } catch {
    console.log("Login FAILED — URL:", page.url());

    // Capture any error message shown on page
    const errEl = page.locator(".bg-red-50, [role='alert']");
    const errCount = await errEl.count();
    if (errCount > 0) {
      const errText = await errEl.first().textContent();
      console.log("Login error message:", errText);
    }
    return false;
  }
}

// ─── Test 01: Landing page ────────────────────────────────────────────────────

test("01 - landing page (unauthenticated)", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForLoad(page);

  const title = await page.title();
  console.log("Title:", title);

  await shot(page, "noshowzero-01-landing.png");

  if (errors.length) console.log("Console errors:", errors);
});

// ─── Test 02: Login page ──────────────────────────────────────────────────────

test("02 - login page", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await waitForLoad(page);
  await page.waitForSelector('input[id="email"]', { timeout: 10_000 });

  await shot(page, "noshowzero-02-login.png");

  const hasEmail = (await page.locator('input[id="email"]').count()) > 0;
  const hasPassword = (await page.locator('input[id="password"]').count()) > 0;
  const hasSubmit = (await page.locator('button[type="submit"]').count()) > 0;
  console.log(
    `Form fields — email: ${hasEmail}, password: ${hasPassword}, submit: ${hasSubmit}`
  );

  if (errors.length) console.log("Console errors:", errors);
});

// ─── Test 03: Login attempt ───────────────────────────────────────────────────

test("03 - login attempt", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[id="email"]', { timeout: 15_000 });
  await page.waitForTimeout(500);

  await page.locator('input[id="email"]').fill(EMAIL);
  await page.locator('input[id="password"]').fill(PASSWORD);
  await page.waitForTimeout(300);
  await shot(page, "noshowzero-03-login-filled.png");

  await page.locator('button[type="submit"]').click();

  try {
    await page.waitForURL(/\/(dashboard|app|home)/, { timeout: 20_000 });
    await waitForLoad(page);
    console.log("Redirected to:", page.url());
    await shot(page, "noshowzero-03-post-login.png");
  } catch {
    console.log("No redirect after login, URL:", page.url());
    await shot(page, "noshowzero-03-login-no-redirect.png");
  }

  if (errors.length) console.log("Console errors:", errors);
});

// ─── Test 04: All authenticated pages ────────────────────────────────────────

test("04 - authenticated pages audit", async ({ page }) => {
  const loggedIn = await doLogin(page);

  if (!loggedIn) {
    console.log("Skipping — login failed");
    await shot(page, "noshowzero-AUTH-FAILED.png");
    return;
  }

  // Wait for dashboard content to render (past the initial spinner)
  await page
    .waitForSelector("h1, h2, [data-testid], main nav, aside nav", { timeout: 15_000 })
    .catch(() => {});
  await waitForLoad(page);
  await page.waitForTimeout(1500); // extra time for dashboard data to load
  await shot(page, "noshowzero-04-dashboard.png");

  const routes: Array<{ path: string; name: string }> = [
    { path: "/appointments", name: "05-appointments" },
    { path: "/calendar", name: "06-calendar" },
    { path: "/patients", name: "07-patients" },
    { path: "/waitlist", name: "08-waitlist" },
    { path: "/strategy-log", name: "09-strategy-log" },
    { path: "/settings", name: "10-settings" },
    { path: "/messages", name: "11-messages" },
    { path: "/analytics", name: "12-analytics" },
    { path: "/rules", name: "13-rules" },
    { path: "/offers", name: "14-offers" },
    { path: "/billing", name: "15-billing" },
    { path: "/integrations", name: "16-integrations" },
    { path: "/ai-chat", name: "17-ai-chat" },
    { path: "/audit", name: "18-audit" },
    { path: "/optimization", name: "19-optimization" },
    { path: "/onboarding", name: "20-onboarding" },
    { path: "/docs", name: "21-docs" },
  ];

  for (const route of routes) {
    const pageErrors: string[] = [];
    page.removeAllListeners("console");
    page.on("console", (m) => {
      if (m.type() === "error") pageErrors.push(m.text());
    });

    console.log(`\n── ${route.path} ──`);

    const resp = await page
      .goto(`${BASE}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      })
      .catch((err: Error) => {
        console.log(`  Nav error: ${err.message}`);
        return null;
      });

    const httpStatus = resp?.status() ?? "N/A";
    await waitForLoad(page);

    const finalUrl = page.url();
    const redirected = !finalUrl.includes(route.path);

    // Scroll to trigger lazy loads
    try {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(100);
    } catch {
      // page may have navigated away — ignore
    }

    await shot(page, `noshowzero-${route.name}.png`);

    console.log(
      `  HTTP: ${httpStatus} | URL: ${finalUrl} | Redirected: ${redirected}`
    );

    // Check for error page indicators
    const notFound = await page.getByText(/404|Page Not Found/i).count();
    const serverErr = await page.getByText(/500|Internal Server Error/i).count();
    const authErr = await page.getByText(/unauthorized|403|forbidden/i).count();
    const stuckSpinner = await page.locator(".animate-spin").count();

    if (notFound) console.log(`  ERROR: 404 / Not Found text on page`);
    if (serverErr) console.log(`  ERROR: 500 / Server Error text on page`);
    if (authErr) console.log(`  ERROR: Auth/403 text on page`);
    if (stuckSpinner) console.log(`  WARNING: ${stuckSpinner} spinner(s) still visible`);

    if (pageErrors.length) {
      console.log(`  Console errors (${pageErrors.length}):`);
      pageErrors.slice(0, 5).forEach((e) => console.log(`    ${e}`));
    }
  }
});
