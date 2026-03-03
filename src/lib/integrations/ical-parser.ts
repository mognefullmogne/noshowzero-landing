/**
 * iCal (.ics) feed parser.
 * Fetches and parses VCALENDAR feeds, expands recurring events up to 6 months.
 * Uses manual VEVENT parsing (no external iCal dependency).
 */

import type { NormalizedCalendarEvent } from "./types";

const MAX_FUTURE_MS = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months
const MAX_ICAL_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Fetch an iCal feed URL and parse into normalized events.
 */
export async function parseICalFeed(
  url: string
): Promise<NormalizedCalendarEvent[]> {
  const response = await fetch(url, {
    headers: { Accept: "text/calendar" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch iCal feed: ${response.status} ${response.statusText}`);
  }

  // Read with size limit to prevent memory exhaustion
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body from iCal feed");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_ICAL_SIZE) {
      reader.cancel();
      throw new Error("iCal feed exceeds 10 MB size limit");
    }
    chunks.push(value);
  }

  const content = Buffer.concat(chunks.map(Buffer.from)).toString("utf-8");
  return parseICalString(content);
}

/**
 * Parse raw iCal (.ics) content into normalized events.
 */
export function parseICalString(content: string): NormalizedCalendarEvent[] {
  const events: NormalizedCalendarEvent[] = [];
  const now = new Date();
  const maxDate = new Date(now.getTime() + MAX_FUTURE_MS);

  // Extract VEVENT blocks
  const eventBlocks = extractBlocks(content, "VEVENT");

  for (const block of eventBlocks) {
    const props = parseProperties(block);

    const uid = props.get("UID") ?? "";
    const summary = props.get("SUMMARY") ?? "Evento";
    const description = props.get("DESCRIPTION") ?? null;
    const location = props.get("LOCATION") ?? null;
    const dtstart = props.get("DTSTART");
    const dtend = props.get("DTEND");
    const duration = props.get("DURATION");
    const status = props.get("STATUS")?.toUpperCase() ?? "CONFIRMED";
    const rrule = props.get("RRULE") ?? null;
    const organizer = props.get("ORGANIZER") ?? null;

    if (!dtstart) continue;

    const startAt = parseICalDate(dtstart);
    if (!startAt) continue;

    let endAt: Date | null = null;
    if (dtend) {
      endAt = parseICalDate(dtend);
    } else if (duration) {
      endAt = addICalDuration(startAt, duration);
    }
    if (!endAt) {
      endAt = new Date(startAt.getTime() + 30 * 60_000); // default 30 min
    }

    // Extract attendees
    const attendees: { name?: string; email?: string }[] = [];
    const attendeeLines = extractMultiValues(block, "ATTENDEE");
    for (const line of attendeeLines) {
      const email = extractMailto(line);
      const cn = extractParam(line, "CN");
      if (email || cn) {
        attendees.push({
          ...(cn ? { name: cn } : {}),
          ...(email ? { email } : {}),
        });
      }
    }

    const organizerEmail = organizer ? extractMailto(organizer) ?? null : null;

    const normalizedStatus = mapStatus(status);

    // Handle recurring events
    if (rrule) {
      const occurrences = expandRRule(startAt, endAt, rrule, now, maxDate);
      for (const occ of occurrences) {
        const dur = endAt.getTime() - startAt.getTime();
        events.push({
          externalId: `${uid}_${occ.toISOString()}`,
          summary,
          description: unfoldDescription(description),
          location,
          startAt: occ.toISOString(),
          endAt: new Date(occ.getTime() + dur).toISOString(),
          attendees,
          organizerEmail,
          status: normalizedStatus,
          recurrenceRule: rrule,
        });
      }
    } else {
      // Skip past events
      if (endAt < now) continue;
      // Skip too far future
      if (startAt > maxDate) continue;

      events.push({
        externalId: uid || `ical_${startAt.toISOString()}`,
        summary,
        description: unfoldDescription(description),
        location,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        attendees,
        organizerEmail,
        status: normalizedStatus,
        recurrenceRule: null,
      });
    }
  }

  return events;
}

// -- iCal parsing helpers --

function extractBlocks(content: string, blockType: string): string[] {
  const blocks: string[] = [];
  const begin = `BEGIN:${blockType}`;
  const end = `END:${blockType}`;
  let idx = 0;

  while (true) {
    const start = content.indexOf(begin, idx);
    if (start === -1) break;
    const finish = content.indexOf(end, start);
    if (finish === -1) break;
    blocks.push(content.slice(start + begin.length, finish));
    idx = finish + end.length;
  }

  return blocks;
}

function parseProperties(block: string): Map<string, string> {
  const props = new Map<string, string>();
  // Unfold continued lines (RFC 5545: line starting with space/tab is continuation)
  const unfolded = block.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    let key = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    // Strip parameters from key (e.g., DTSTART;VALUE=DATE → DTSTART)
    const semiIdx = key.indexOf(";");
    if (semiIdx !== -1) {
      key = key.slice(0, semiIdx);
    }

    key = key.trim().toUpperCase();
    if (key && !props.has(key)) {
      props.set(key, value.trim());
    }
  }

  return props;
}

function extractMultiValues(block: string, propName: string): string[] {
  const results: string[] = [];
  const unfolded = block.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  for (const line of lines) {
    if (line.toUpperCase().startsWith(propName)) {
      results.push(line);
    }
  }

  return results;
}

function extractMailto(str: string): string | null {
  const match = str.match(/mailto:([^\s;>"]+)/i);
  return match ? match[1] : null;
}

function extractParam(str: string, param: string): string | null {
  const regex = new RegExp(`${param}=(?:"([^"]+)"|([^;:]+))`, "i");
  const match = str.match(regex);
  return match ? (match[1] ?? match[2])?.trim() ?? null : null;
}

/** Parse iCal date formats: 20260315T140000Z, 20260315T140000, 20260315 */
function parseICalDate(str: string): Date | null {
  // Remove VALUE=DATE prefix if present
  const cleaned = str.replace(/^.*?(\d{8})/, "$1");

  const match = cleaned.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/
  );
  if (!match) {
    // Try ISO
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  const [, y, mo, d, h, mi, s, z] = match;
  const year = parseInt(y, 10);
  const month = parseInt(mo, 10) - 1;
  const day = parseInt(d, 10);
  const hour = h ? parseInt(h, 10) : 0;
  const minute = mi ? parseInt(mi, 10) : 0;
  const second = s ? parseInt(s, 10) : 0;

  if (z) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  return new Date(year, month, day, hour, minute, second);
}

/** Parse iCal DURATION format: PT1H30M, P1D, PT30M */
function addICalDuration(start: Date, duration: string): Date | null {
  const match = duration.match(
    /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/
  );
  if (!match) return null;

  const days = parseInt(match[1] ?? "0", 10);
  const hours = parseInt(match[2] ?? "0", 10);
  const minutes = parseInt(match[3] ?? "0", 10);
  const seconds = parseInt(match[4] ?? "0", 10);

  const ms = ((days * 24 + hours) * 60 + minutes) * 60_000 + seconds * 1000;
  return new Date(start.getTime() + ms);
}

function mapStatus(
  icalStatus: string
): "confirmed" | "tentative" | "cancelled" {
  switch (icalStatus) {
    case "CANCELLED":
      return "cancelled";
    case "TENTATIVE":
      return "tentative";
    default:
      return "confirmed";
  }
}

function unfoldDescription(desc: string | null): string | null {
  if (!desc) return null;
  return desc.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\\\/g, "\\");
}

/**
 * Simple RRULE expansion. Supports FREQ=DAILY|WEEKLY|MONTHLY with COUNT and UNTIL.
 * Limits to 200 occurrences max for safety.
 */
function expandRRule(
  dtstart: Date,
  _dtend: Date,
  rrule: string,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const parts = new Map<string, string>();
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) parts.set(k.toUpperCase(), v);
  }

  const freq = parts.get("FREQ");
  const count = parts.has("COUNT") ? parseInt(parts.get("COUNT")!, 10) : 200;
  const until = parts.has("UNTIL")
    ? parseICalDate(parts.get("UNTIL")!) ?? rangeEnd
    : rangeEnd;
  const interval = parts.has("INTERVAL")
    ? parseInt(parts.get("INTERVAL")!, 10)
    : 1;

  const occurrences: Date[] = [];
  let current = new Date(dtstart);
  const maxOccurrences = Math.min(count, 200);

  for (let i = 0; i < maxOccurrences && current <= until && current <= rangeEnd; i++) {
    if (current >= rangeStart) {
      occurrences.push(new Date(current));
    }

    switch (freq) {
      case "DAILY":
        current = new Date(current.getTime() + interval * 86_400_000);
        break;
      case "WEEKLY":
        current = new Date(current.getTime() + interval * 7 * 86_400_000);
        break;
      case "MONTHLY":
        current = new Date(current);
        current.setMonth(current.getMonth() + interval);
        break;
      default:
        return occurrences; // unsupported freq
    }
  }

  return occurrences;
}
