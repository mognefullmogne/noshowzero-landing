// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * CSV parser for appointment imports.
 * Auto-detects delimiter, date format, and common export formats
 * (Google Calendar, Outlook, generic).
 *
 * Max: 5 MB file, 10,000 rows.
 */

import type { NormalizedCalendarEvent } from "./types";
import { createHash } from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 10_000;

interface CsvParseResult {
  readonly events: NormalizedCalendarEvent[];
  readonly errors: readonly { row: number; reason: string }[];
}

export function parseCsvBuffer(buffer: Buffer): CsvParseResult {
  if (buffer.length > MAX_FILE_SIZE) {
    return { events: [], errors: [{ row: 0, reason: `File exceeds 5 MB limit (${Math.round(buffer.length / 1024)} KB)` }] };
  }

  const content = buffer.toString("utf-8");
  return parseCsvString(content);
}

export function parseCsvString(content: string): CsvParseResult {
  const delimiter = detectDelimiter(content);
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { events: [], errors: [{ row: 0, reason: "File has no data rows" }] };
  }

  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
  const mapping = detectColumnMapping(headers);

  if (!mapping.date && !mapping.startDateTime) {
    return { events: [], errors: [{ row: 0, reason: "Cannot detect date/time columns. Expected: date, start_date, Subject, Start Date, or similar." }] };
  }

  const events: NormalizedCalendarEvent[] = [];
  const errors: { row: number; reason: string }[] = [];
  const dataLines = lines.slice(1);

  if (dataLines.length > MAX_ROWS) {
    return { events: [], errors: [{ row: 0, reason: `File exceeds ${MAX_ROWS} row limit (${dataLines.length} rows)` }] };
  }

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2; // 1-indexed + header
    try {
      const cols = parseCsvLine(dataLines[i], delimiter);
      const event = mapRowToEvent(cols, headers, mapping);
      if (event) {
        events.push(event);
      } else {
        errors.push({ row: rowNum, reason: "Could not parse date/time" });
      }
    } catch (err) {
      errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : "Parse error",
      });
    }
  }

  return { events, errors };
}

// -- Column mapping detection --

interface ColumnMapping {
  summary: number | null;
  date: number | null;
  startTime: number | null;
  endTime: number | null;
  startDateTime: number | null;
  endDateTime: number | null;
  duration: number | null;
  location: number | null;
  description: number | null;
  patientName: number | null;
  patientPhone: number | null;
  patientEmail: number | null;
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const m: ColumnMapping = {
    summary: null, date: null, startTime: null, endTime: null,
    startDateTime: null, endDateTime: null, duration: null,
    location: null, description: null, patientName: null,
    patientPhone: null, patientEmail: null,
  };

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (matches(h, ["subject", "summary", "title", "service", "service_name", "servizio", "oggetto"])) {
      m.summary = i;
    } else if (matches(h, ["start_date", "startdate", "date", "data"])) {
      m.date ??= i;
    } else if (matches(h, ["start_time", "starttime", "time", "ora", "ora_inizio"])) {
      m.startTime = i;
    } else if (matches(h, ["end_time", "endtime", "ora_fine"])) {
      m.endTime = i;
    } else if (matches(h, ["start_date_time", "start", "inizio", "dtstart"])) {
      m.startDateTime = i;
    } else if (matches(h, ["end_date_time", "end", "fine", "dtend", "end_date"])) {
      m.endDateTime = i;
    } else if (matches(h, ["duration", "duration_min", "durata"])) {
      m.duration = i;
    } else if (matches(h, ["location", "luogo", "sede"])) {
      m.location = i;
    } else if (matches(h, ["description", "notes", "note", "descrizione"])) {
      m.description = i;
    } else if (matches(h, ["patient_name", "patient", "paziente", "nome", "name", "attendee"])) {
      m.patientName = i;
    } else if (matches(h, ["patient_phone", "phone", "telefono", "cellulare"])) {
      m.patientPhone = i;
    } else if (matches(h, ["patient_email", "email", "e-mail"])) {
      m.patientEmail = i;
    }
  }

  return m;
}

function matches(header: string, keywords: string[]): boolean {
  return keywords.includes(header);
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

// -- Row to event mapping --

function mapRowToEvent(
  cols: string[],
  headers: string[],
  mapping: ColumnMapping
): NormalizedCalendarEvent | null {
  const get = (idx: number | null): string =>
    idx !== null && idx < cols.length ? cols[idx].trim() : "";

  // Parse start/end times
  let startAt: Date | null = null;
  let endAt: Date | null = null;

  if (mapping.startDateTime !== null) {
    startAt = parseFlexibleDateTime(get(mapping.startDateTime));
    if (mapping.endDateTime !== null) {
      endAt = parseFlexibleDateTime(get(mapping.endDateTime));
    }
  }

  if (!startAt && mapping.date !== null) {
    const dateStr = get(mapping.date);
    const timeStr = mapping.startTime !== null ? get(mapping.startTime) : "09:00";
    startAt = parseDateAndTime(dateStr, timeStr);

    if (mapping.endTime !== null) {
      endAt = parseDateAndTime(dateStr, get(mapping.endTime));
    }
  }

  if (!startAt) return null;

  // Calculate end from duration if not set
  if (!endAt && mapping.duration !== null) {
    const durationMin = parseInt(get(mapping.duration), 10);
    if (!isNaN(durationMin) && durationMin > 0) {
      endAt = new Date(startAt.getTime() + durationMin * 60_000);
    }
  }

  // Default 30 min if no end
  if (!endAt) {
    endAt = new Date(startAt.getTime() + 30 * 60_000);
  }

  const summary = get(mapping.summary) || "Appuntamento";
  const attendees: { name?: string; email?: string; phone?: string }[] = [];
  const patientName = get(mapping.patientName);
  const patientPhone = get(mapping.patientPhone);
  const patientEmail = get(mapping.patientEmail);

  if (patientName || patientPhone || patientEmail) {
    attendees.push({
      ...(patientName ? { name: patientName } : {}),
      ...(patientPhone ? { phone: patientPhone } : {}),
      ...(patientEmail ? { email: patientEmail } : {}),
    });
  }

  // Deterministic ID from content hash — re-uploading same CSV skips duplicates
  const hashInput = `${startAt.toISOString()}|${endAt.toISOString()}|${summary}|${get(mapping.patientName)}|${get(mapping.patientPhone)}`;
  const hash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

  return {
    externalId: `csv_${hash}`,
    summary,
    description: get(mapping.description) || null,
    location: get(mapping.location) || null,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    attendees,
    organizerEmail: null,
    status: "confirmed",
    recurrenceRule: null,
  };
}

// -- Date parsing helpers --

/** Parse a flexible date+time string (ISO, US, EU) */
function parseFlexibleDateTime(str: string): Date | null {
  if (!str) return null;

  // Try ISO first
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso;

  // Try "DD/MM/YYYY HH:MM" or "MM/DD/YYYY HH:MM"
  const match = str.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (match) {
    return parseDateParts(match[1], match[2], match[3], match[4], match[5], match[6]);
  }

  return null;
}

/** Parse separate date and time strings */
function parseDateAndTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;

  const dateMatch = dateStr.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dateMatch) {
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    const h = timeMatch ? timeMatch[1] : "9";
    const m = timeMatch ? timeMatch[2] : "00";
    const s = timeMatch ? timeMatch[3] : undefined;
    return parseDateParts(dateMatch[1], dateMatch[2], dateMatch[3], h, m, s);
  }

  // Try ISO date
  const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr;
  const d = new Date(combined);
  return isNaN(d.getTime()) ? null : d;
}

/** Resolve DD/MM/YYYY vs MM/DD/YYYY ambiguity (EU-first for Italian clinic) */
function parseDateParts(
  p1: string, p2: string, yearStr: string,
  hour?: string, minute?: string, second?: string
): Date | null {
  let year = parseInt(yearStr, 10);
  if (year < 100) year += 2000;

  const a = parseInt(p1, 10);
  const b = parseInt(p2, 10);

  // EU format (DD/MM): p1 is day, p2 is month — default for Italian clinics
  let day = a;
  let month = b;

  // If p1 > 12, it must be day. If p2 > 12, it must be day (US format).
  if (a > 12 && b <= 12) {
    day = a;
    month = b;
  } else if (b > 12 && a <= 12) {
    day = b;
    month = a;
  }
  // Both ≤ 12: assume EU (DD/MM) since target users are Italian

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const h = hour ? parseInt(hour, 10) : 0;
  const m = minute ? parseInt(minute, 10) : 0;
  const s = second ? parseInt(second, 10) : 0;

  const d = new Date(year, month - 1, day, h, m, s);
  return isNaN(d.getTime()) ? null : d;
}

// -- CSV line parser --

function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;

  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

/** Parse a single CSV line respecting quoted fields */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}
