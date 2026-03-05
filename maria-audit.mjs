// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

console.log('🔵 Maria: Logging in...');
await page.goto('https://noshowzero-landing.vercel.app/login', { waitUntil: 'networkidle' });

// Fill in credentials
await page.fill('input[placeholder="you@company.com"]', 'aimonepitacco@gmail.com');
await page.fill('input[placeholder="Enter your password"]', 'Aimone123!');
await page.click('button:has-text("Log In")');

// Wait a bit for response
await page.waitForTimeout(3000);

// Check if we got an error message
const errorMsg = await page.$('.text-red-500, .error, [role="alert"]');
if (errorMsg) {
  const text = await errorMsg.textContent();
  console.log(`⚠️ Error message: ${text}`);
}

// Take screenshot to see current state
await page.screenshot({ path: '/tmp/user-sim-login-attempt.png' });
console.log('📸 Screenshot: /tmp/user-sim-login-attempt.png');

// Check current URL
const url = page.url();
console.log(`📍 Current URL: ${url}`);

await browser.close();
