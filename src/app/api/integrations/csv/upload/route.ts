// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * POST /api/integrations/csv/upload
 * Accept CSV file (multipart), parse, import appointments, return results.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { parseCsvBuffer } from "@/lib/integrations/csv-parser";
import { importCalendarEvents } from "@/lib/integrations/appointment-importer";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
  "", // Some browsers send empty MIME for .csv
]);

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth.ok) return auth.response;

  const { tenantId } = auth.data;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_BODY", message: "Expected multipart form data with CSV file" } },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FILE", message: "No file provided. Use field name 'file'." } },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: { code: "FILE_TOO_LARGE", message: "File exceeds 5 MB limit" } },
      { status: 400 }
    );
  }

  // Validate MIME type
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_FILE_TYPE", message: "Only CSV files are accepted" } },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Reject binary content (null bytes indicate non-text file)
  if (buffer.includes(0)) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_FILE_CONTENT", message: "File contains invalid binary content" } },
      { status: 400 }
    );
  }

  // Parse CSV
  const parseResult = parseCsvBuffer(buffer);

  if (parseResult.errors.length > 0 && parseResult.events.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PARSE_ERROR",
          message: "Could not parse CSV file",
          details: parseResult.errors,
        },
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Create import log
  const { data: importLog } = await supabase
    .from("import_logs")
    .insert({
      tenant_id: tenantId,
      provider: "csv",
      status: "running",
      total_events: parseResult.events.length,
    })
    .select("id")
    .single();

  // Run import pipeline
  const result = await importCalendarEvents(
    supabase,
    tenantId,
    parseResult.events
  );

  // Update import log
  if (importLog) {
    await supabase
      .from("import_logs")
      .update({
        status: result.failed > 0 && result.imported === 0 ? "failed" : "completed",
        total_events: result.total,
        imported: result.imported,
        skipped: result.skipped,
        failed: result.failed,
        error_details: result.errors,
        completed_at: new Date().toISOString(),
      })
      .eq("id", importLog.id);
  }

  return NextResponse.json({
    success: true,
    data: {
      total: result.total,
      imported: result.imported,
      skipped: result.skipped,
      failed: result.failed,
      errors: result.errors,
      parseErrors: parseResult.errors,
    },
  });
}
