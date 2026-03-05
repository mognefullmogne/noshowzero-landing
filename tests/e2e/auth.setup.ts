// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Auth setup — runs once before all E2E tests.
 * Logs in with the test account and saves session to disk so all tests
 * can reuse it without logging in repeatedly.
 *
 * Credentials come from environment variables:
 *   E2E_EMAIL     (default: aimonepitacco@gmail.com)
 *   E2E_PASSWORD  (required — set in .env.local or CI secrets)
 */

import { test as setup, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const AUTH_FILE = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL ?? "aimonepitacco@gmail.com";
  const password = process.env.E2E_PASSWORD;

  if (!password) {
    throw new Error(
      "E2E_PASSWORD environment variable is required. Add it to .env.local:\n  E2E_PASSWORD=yourpassword"
    );
  }

  await page.goto("/login");

  // Fill login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Should redirect to dashboard after successful login
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Ensure the auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  // Save authenticated state
  await page.context().storageState({ path: AUTH_FILE });
});
