#!/usr/bin/env node
/**
 * Verify post-migration infrastructure state and auto-fix known issues.
 *
 * Checks all 16 tables (migrations 004-011) for existence, RLS, and policies.
 * Auto-fixes migration 010 RLS policy mismatch (current_setting -> auth.uid()).
 * Verifies Realtime publication, replica identity, and data integrity.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres" node scripts/verify-infrastructure.mjs
 *
 * You can find your DATABASE_URL in:
 *   Supabase Dashboard -> Project Settings -> Database -> Connection string (URI)
 *
 * Exit codes:
 *   0 = All checks passed (with or without auto-fixes)
 *   1 = One or more checks failed
 */

import pg from "pg";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  console.error(
    'Usage: DATABASE_URL="postgresql://..." node scripts/verify-infrastructure.mjs'
  );
  process.exit(1);
}

/**
 * All 16 tables created by migrations 004-011.
 * Order matches migration numbering for readability.
 */
const EXPECTED_TABLES = [
  // 004: messaging
  "message_threads",
  "message_events",
  "delivery_statuses",
  // 005: appointment_slots
  "appointment_slots",
  // 006: optimization
  "optimization_decisions",
  // 007: rules
  "rulesets",
  "rule_versions",
  // 008: audit
  "audit_events",
  // 009: workflows
  "confirmation_workflows",
  "slot_proposals",
  "kpi_snapshots",
  "failed_jobs",
  // 010: booking_sessions
  "booking_sessions",
  "tenant_phone_numbers",
  // 011: integrations
  "calendar_integrations",
  "import_logs",
];

/**
 * Tables from migration 010 that may have the wrong RLS pattern.
 * These used current_setting('app.tenant_id') instead of auth.uid().
 */
const MIGRATION_010_TABLES = ["booking_sessions", "tenant_phone_numbers"];

/**
 * Tables that should only have SELECT policies (service_role insert-only).
 * See RESEARCH.md Pitfall 6.
 */
const SELECT_ONLY_TABLES = ["audit_events"];

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

/** @type {Array<{ check: string, status: 'PASS' | 'FAIL' | 'FIXED', detail: string }>} */
const results = [];

function recordPass(check, detail) {
  results.push({ check, status: "PASS", detail });
  console.log(`  PASS  ${detail}`);
}

function recordFail(check, detail) {
  results.push({ check, status: "FAIL", detail });
  console.log(`  FAIL  ${detail}`);
}

function recordFixed(check, detail) {
  results.push({ check, status: "FIXED", detail });
  console.log(`  FIXED ${detail}`);
}

// ---------------------------------------------------------------------------
// Check helpers — each wraps queries in try/catch so one failure
// does not abort remaining checks.
// ---------------------------------------------------------------------------

/**
 * 1. Table existence check
 */
async function checkTableExists(client, tableName) {
  try {
    const { rows } = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = $1",
      [tableName]
    );
    if (rows.length > 0) {
      recordPass("table_exists", `${tableName} exists`);
      return true;
    }
    recordFail("table_exists", `${tableName} missing`);
    return false;
  } catch (err) {
    recordFail("table_exists", `${tableName} query error: ${err.message}`);
    return false;
  }
}

/**
 * 2. RLS enablement check
 */
async function checkRlsEnabled(client, tableName) {
  try {
    const { rows } = await client.query(
      "SELECT relrowsecurity FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace",
      [tableName]
    );
    if (rows.length === 0) {
      recordFail("rls_enabled", `${tableName} not found in pg_class`);
      return false;
    }
    if (rows[0].relrowsecurity) {
      recordPass("rls_enabled", `${tableName} has RLS enabled`);
      return true;
    }
    recordFail("rls_enabled", `${tableName} RLS disabled`);
    return false;
  } catch (err) {
    recordFail("rls_enabled", `${tableName} RLS check error: ${err.message}`);
    return false;
  }
}

/**
 * 3. RLS policy check — at least one SELECT-compatible policy (cmd = 'r' or '*')
 */
async function checkRlsPolicy(client, tableName) {
  try {
    const { rows } = await client.query(
      "SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
      [tableName]
    );

    // Count SELECT-compatible policies: cmd 'r' (SELECT) or '*' (ALL)
    const selectPolicies = rows.filter(
      (r) => r.cmd === "r" || r.cmd === "*"
    );

    if (selectPolicies.length > 0) {
      recordPass(
        "rls_policy",
        `${tableName} has ${selectPolicies.length} SELECT-compatible ${selectPolicies.length === 1 ? "policy" : "policies"}`
      );
      return true;
    }

    // Special case: audit_events may have no SELECT policy if it is
    // insert-only via service_role (see RESEARCH.md Pitfall 6).
    // However the plan says "accept SELECT-only policy as valid",
    // meaning if it HAS one it is fine. If it has none, still report.
    if (SELECT_ONLY_TABLES.includes(tableName) && rows.length > 0) {
      recordPass(
        "rls_policy",
        `${tableName} has ${rows.length} ${rows.length === 1 ? "policy" : "policies"} (insert-only by design)`
      );
      return true;
    }

    recordFail(
      "rls_policy",
      `${tableName} has no SELECT-compatible policy (found ${rows.length} total)`
    );
    return false;
  } catch (err) {
    recordFail(
      "rls_policy",
      `${tableName} policy check error: ${err.message}`
    );
    return false;
  }
}

/**
 * 4. Auto-fix migration 010 RLS policies.
 *
 * Detection strategy (simple approach from plan):
 *   If policyname matches the migration 010 names
 *   (`booking_sessions_tenant_isolation` / `tenant_phone_numbers_tenant_isolation`),
 *   drop and recreate with correct auth.uid() pattern.
 *   If policyname is "Tenant isolation" (the corrected name), skip.
 */
async function fixMigration010Policy(client, tableName) {
  try {
    const { rows } = await client.query(
      "SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
      [tableName]
    );

    const policyNames = rows.map((r) => r.policyname);
    const oldPolicyName = `${tableName}_tenant_isolation`;

    // Check if the old (incorrect) policy name exists
    if (policyNames.includes(oldPolicyName)) {
      await client.query(
        `DROP POLICY IF EXISTS "${oldPolicyName}" ON ${tableName}`
      );
      await client.query(
        `CREATE POLICY "Tenant isolation" ON ${tableName}
         FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()))`
      );
      recordFixed(
        "rls_010_fix",
        `${tableName} RLS policy (was current_setting, now auth.uid())`
      );
      return;
    }

    // Also check via pg_get_expr for current_setting in any policy qual
    const { rows: qualRows } = await client.query(
      `SELECT policyname, pg_get_expr(p.polqual, p.polrelid) AS qual_expr
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       WHERE c.relname = $1 AND c.relnamespace = 'public'::regnamespace`,
      [tableName]
    );

    const badPolicy = qualRows.find(
      (r) => r.qual_expr && r.qual_expr.includes("current_setting")
    );

    if (badPolicy) {
      await client.query(
        `DROP POLICY IF EXISTS "${badPolicy.policyname}" ON ${tableName}`
      );
      await client.query(
        `CREATE POLICY "Tenant isolation" ON ${tableName}
         FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()))`
      );
      recordFixed(
        "rls_010_fix",
        `${tableName} RLS policy (was current_setting, now auth.uid())`
      );
      return;
    }

    // Policy is already correct
    console.log(`  OK    ${tableName} RLS policy already correct`);
  } catch (err) {
    recordFail(
      "rls_010_fix",
      `${tableName} RLS auto-fix error: ${err.message}`
    );
  }
}

/**
 * 5. Auto-create missing RLS policies for tables that have none.
 */
async function createMissingPolicy(client, tableName) {
  try {
    const { rows } = await client.query(
      "SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
      [tableName]
    );

    if (rows.length === 0) {
      await client.query(
        `CREATE POLICY "Tenant isolation" ON ${tableName}
         FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()))`
      );
      recordFixed("rls_missing_fix", `Created missing RLS policy for ${tableName}`);
    }
  } catch (err) {
    recordFail(
      "rls_missing_fix",
      `${tableName} missing policy creation error: ${err.message}`
    );
  }
}

/**
 * 6. Publication check — appointments in supabase_realtime
 */
async function checkPublication(client) {
  try {
    const { rows } = await client.query(
      "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'"
    );
    if (rows.length > 0) {
      recordPass(
        "publication",
        "appointments in supabase_realtime publication"
      );
    } else {
      recordFail(
        "publication",
        "appointments not in supabase_realtime publication"
      );
    }
  } catch (err) {
    recordFail("publication", `publication check error: ${err.message}`);
  }
}

/**
 * 7. Replica identity check — appointments should have FULL ('f')
 */
async function checkReplicaIdentity(client) {
  try {
    const { rows } = await client.query(
      "SELECT relreplident FROM pg_class WHERE relname = 'appointments' AND relnamespace = 'public'::regnamespace"
    );
    if (rows.length === 0) {
      recordFail("replica_identity", "appointments table not found");
      return;
    }
    const identity = rows[0].relreplident;
    if (identity === "f") {
      recordPass("replica_identity", "appointments REPLICA IDENTITY = FULL");
    } else {
      const labels = { d: "DEFAULT", n: "NOTHING", i: "INDEX" };
      const label = labels[identity] || identity;
      recordFail(
        "replica_identity",
        `appointments REPLICA IDENTITY = ${label} (expected FULL)`
      );
    }
  } catch (err) {
    recordFail(
      "replica_identity",
      `REPLICA IDENTITY check error: ${err.message}`
    );
  }
}

/**
 * 8. Data integrity checks
 */
async function checkDataIntegrity(client) {
  // Patient: stefano rossi
  try {
    const { rows } = await client.query(
      "SELECT id, first_name, last_name FROM patients WHERE last_name ILIKE '%rossi%' LIMIT 1"
    );
    if (rows.length > 0) {
      recordPass(
        "data_integrity",
        `patient ${rows[0].first_name} ${rows[0].last_name} exists`
      );
    } else {
      recordFail("data_integrity", "patient record with last_name rossi missing");
    }
  } catch (err) {
    recordFail("data_integrity", `patient query error: ${err.message}`);
  }

  // Appointment: esame prostata
  try {
    const { rows } = await client.query(
      "SELECT id, service_name FROM appointments WHERE service_name ILIKE '%prostata%' LIMIT 1"
    );
    if (rows.length > 0) {
      recordPass("data_integrity", `appointment ${rows[0].service_name} exists`);
    } else {
      recordFail(
        "data_integrity",
        "appointment record with service_name prostata missing"
      );
    }
  } catch (err) {
    recordFail("data_integrity", `appointment query error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to database.\n");

    // -----------------------------------------------------------------------
    // 1. Table existence
    // -----------------------------------------------------------------------
    console.log("--- 1. Table Existence (16 tables from migrations 004-011) ---");
    const tableExists = {};
    for (const table of EXPECTED_TABLES) {
      tableExists[table] = await checkTableExists(client, table);
    }

    // -----------------------------------------------------------------------
    // 2. RLS enablement
    // -----------------------------------------------------------------------
    console.log("\n--- 2. RLS Enablement ---");
    for (const table of EXPECTED_TABLES) {
      if (tableExists[table]) {
        await checkRlsEnabled(client, table);
      }
    }

    // -----------------------------------------------------------------------
    // 3. RLS policy check
    // -----------------------------------------------------------------------
    console.log("\n--- 3. RLS Policy Check ---");
    for (const table of EXPECTED_TABLES) {
      if (tableExists[table]) {
        await checkRlsPolicy(client, table);
      }
    }

    // -----------------------------------------------------------------------
    // 4. Migration 010 RLS auto-fix
    // -----------------------------------------------------------------------
    console.log("\n--- 4. Migration 010 RLS Auto-Fix ---");
    for (const table of MIGRATION_010_TABLES) {
      if (tableExists[table]) {
        await fixMigration010Policy(client, table);
      }
    }

    // -----------------------------------------------------------------------
    // 5. Auto-create missing RLS policies
    // -----------------------------------------------------------------------
    console.log("\n--- 5. Missing RLS Policy Auto-Fix ---");
    for (const table of EXPECTED_TABLES) {
      if (tableExists[table]) {
        await createMissingPolicy(client, table);
      }
    }

    // -----------------------------------------------------------------------
    // 6. Publication check
    // -----------------------------------------------------------------------
    console.log("\n--- 6. Realtime Publication Check ---");
    await checkPublication(client);

    // -----------------------------------------------------------------------
    // 7. Replica identity check
    // -----------------------------------------------------------------------
    console.log("\n--- 7. Replica Identity Check ---");
    await checkReplicaIdentity(client);

    // -----------------------------------------------------------------------
    // 8. Data integrity
    // -----------------------------------------------------------------------
    console.log("\n--- 8. Data Integrity Check ---");
    await checkDataIntegrity(client);

    // -----------------------------------------------------------------------
    // 9. Summary
    // -----------------------------------------------------------------------
    const passCount = results.filter((r) => r.status === "PASS").length;
    const failCount = results.filter((r) => r.status === "FAIL").length;
    const fixedCount = results.filter((r) => r.status === "FIXED").length;

    console.log("\n=== INFRASTRUCTURE VERIFICATION SUMMARY ===");
    console.log(`PASS:  ${passCount} checks`);
    console.log(`FAIL:  ${failCount} checks`);
    console.log(`FIXED: ${fixedCount} issues auto-corrected`);

    if (failCount > 0) {
      console.log("\nFailed checks:");
      for (const r of results.filter((r) => r.status === "FAIL")) {
        console.log(`  - ${r.detail}`);
      }
      process.exit(1);
    }

    console.log("\nAll infrastructure checks passed.");
  } catch (err) {
    console.error("\nVerification failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
