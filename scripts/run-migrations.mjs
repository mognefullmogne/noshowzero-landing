#!/usr/bin/env node
/**
 * Run pending Supabase migrations (004-011) and configure Realtime publication.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres" node scripts/run-migrations.mjs
 *
 * You can find your DATABASE_URL in:
 *   Supabase Dashboard → Project Settings → Database → Connection string (URI)
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  console.error(
    'Usage: DATABASE_URL="postgresql://..." node scripts/run-migrations.mjs'
  );
  process.exit(1);
}

const MIGRATIONS = [
  "004_messaging.sql",
  "005_appointment_slots.sql",
  "006_optimization.sql",
  "007_rules.sql",
  "008_audit.sql",
  "009_workflows.sql",
  "010_booking_sessions.sql",
  "011_integrations.sql",
];

/**
 * Wait for the user to press Enter before proceeding.
 * Returns a promise that resolves when Enter is pressed.
 */
function waitForEnter() {
  const rl = createInterface({ input: process.stdin });
  return new Promise((resolve) => {
    rl.once("line", () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Print PITR checkpoint timestamp and wait for user confirmation.
 */
async function pitrCheckpoint() {
  const timestamp = new Date().toISOString();

  console.log("\n========================================");
  console.log(`PITR Recovery Checkpoint: ${timestamp}`);
  console.log("========================================");
  console.log(
    "Note this timestamp. If anything goes wrong, restore to this point in Supabase Dashboard > Database > Backups."
  );
  console.log("Press Enter to continue or Ctrl+C to abort...");

  await waitForEnter();
}

/**
 * Run all migration SQL files in order, skipping those already applied.
 */
async function runMigrations(client) {
  for (const migration of MIGRATIONS) {
    const filePath = join(ROOT, "supabase", "migrations", migration);
    const sql = readFileSync(filePath, "utf-8");

    console.log(`Running ${migration}...`);
    try {
      await client.query(sql);
      console.log(`  OK ${migration} applied successfully`);
    } catch (err) {
      // Skip if objects already exist
      if (err.message.includes("already exists")) {
        console.log(`  SKIP ${migration} — already applied (skipped)`);
      } else {
        console.error(`  FAIL ${migration} failed: ${err.message}`);
        throw err;
      }
    }
  }
}

/**
 * Add the appointments table to the supabase_realtime publication
 * and set REPLICA IDENTITY FULL for complete row data in change events.
 */
async function configureRealtime(client) {
  console.log("\nConfiguring Realtime publication...");

  // Idempotent: only add if not already a member
  const publicationSql = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
      END IF;
    END $$;
  `;

  try {
    await client.query(publicationSql);

    // Check whether the table was already in the publication
    const { rows } = await client.query(
      "SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'"
    );
    if (rows.length > 0) {
      console.log("  OK appointments added to supabase_realtime publication");
    } else {
      console.log(
        "  SKIP appointments already in supabase_realtime publication"
      );
    }
  } catch (err) {
    if (err.message.includes("already member")) {
      console.log(
        "  SKIP appointments already in supabase_realtime publication"
      );
    } else {
      throw err;
    }
  }

  // REPLICA IDENTITY FULL is always safe to re-run
  await client.query("ALTER TABLE appointments REPLICA IDENTITY FULL;");
  console.log("  OK appointments REPLICA IDENTITY set to FULL");
}

async function main() {
  // PITR checkpoint: record timestamp and wait for user confirmation
  await pitrCheckpoint();

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to database.\n");

    await runMigrations(client);

    await configureRealtime(client);

    console.log("\nAll migrations and Realtime configuration applied successfully!");
  } catch (err) {
    console.error("\nMigration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
