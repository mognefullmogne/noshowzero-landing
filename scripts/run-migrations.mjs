#!/usr/bin/env node
/**
 * Run pending Supabase migrations (004-009).
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
];

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to database.");

    for (const migration of MIGRATIONS) {
      const filePath = join(ROOT, "supabase", "migrations", migration);
      const sql = readFileSync(filePath, "utf-8");

      console.log(`Running ${migration}...`);
      try {
        await client.query(sql);
        console.log(`  ✓ ${migration} applied successfully`);
      } catch (err) {
        // Skip if objects already exist
        if (err.message.includes("already exists")) {
          console.log(`  ⊘ ${migration} — already applied (skipped)`);
        } else {
          console.error(`  ✗ ${migration} failed: ${err.message}`);
          throw err;
        }
      }
    }

    console.log("\nAll migrations applied successfully!");
  } catch (err) {
    console.error("\nMigration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
