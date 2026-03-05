/**
 * One-shot script: trigger backfill for a cancelled appointment.
 * Usage: npx tsx --tsconfig tsconfig.json scripts/test-backfill.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load .env.local and strip Vercel's trailing \n literals
config({ path: ".env.local" });
for (const [k, v] of Object.entries(process.env)) {
  if (typeof v === "string" && v.endsWith("\\n")) {
    process.env[k] = v.slice(0, -2);
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const APPOINTMENT_ID = "f85b0e7e-976b-41a1-a42a-fb1c75d01f00";
const TENANT_ID = "e1d14300-10cb-42d0-9e9d-eb8fee866570";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("[Test] Importing triggerBackfill...");
  const { triggerBackfill } = await import("@/lib/backfill/trigger-backfill");

  console.log(`[Test] Triggering backfill for appointment ${APPOINTMENT_ID}...`);
  const offerId = await triggerBackfill(supabase, APPOINTMENT_ID, TENANT_ID, {
    triggerEvent: "cancellation",
  });

  if (offerId) {
    console.log(`[Test] SUCCESS — Offer created: ${offerId}`);
  } else {
    console.log("[Test] No offer created (check logs above for reason)");
  }
}

main().catch((err) => {
  console.error("[Test] Fatal error:", err);
  process.exit(1);
});
