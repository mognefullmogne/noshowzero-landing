const TIMEZONE = "Europe/Rome";
const LOCALE = "it-IT";

/** Format date only: "12 mar 2026" */
export function formatDate(
  isoString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(isoString).toLocaleDateString(
    LOCALE,
    { timeZone: TIMEZONE, ...options }
  );
}

/** Format time only: "15:00" */
export function formatTime(
  isoString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(isoString).toLocaleTimeString(
    LOCALE,
    { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", ...options }
  );
}

/** Format date + time: "12 mar 2026, 15:00" */
export function formatDateTime(
  isoString: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(isoString).toLocaleString(
    LOCALE,
    { timeZone: TIMEZONE, ...options }
  );
}

/** Format a Date object as localized date string (for "today" type usage) */
export function formatDateObj(
  date: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleDateString(LOCALE, { timeZone: TIMEZONE, ...options });
}

/** Format a Date object as localized time string */
export function formatTimeObj(
  date: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleTimeString(
    LOCALE,
    { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", ...options }
  );
}
