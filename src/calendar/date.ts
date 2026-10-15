/**
 * Family OS calendar date contract. Date-only deadlines are local calendar days;
 * explicit Z/offset timestamps are instants converted to the browser's local day;
 * offset-free datetime strings are local wall-clock entries.
 *
 * This is display parsing, NOT evidence of a trusted data source or authorization.
 */
export function localDateISO(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

export function isValidDateKey(value: string | null | undefined): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function parseLocalCalendarDatetime(raw: string | null | undefined): Date | null {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|([+-])(\d{2}):(\d{2}))?$/);
  if (!match || !isValidDateKey(match[1])) return null;

  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = match[4] ? Number(match[4]) : 0;
  const offsetHours = match[8] ? Number(match[8]) : 0;
  const offsetMinutes = match[9] ? Number(match[9]) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59 ||
      offsetHours > 14 || offsetMinutes > 59 ||
      (offsetHours === 14 && offsetMinutes !== 0)) return null;

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  // Do not silently turn nonexistent local DST times into a different time.
  if (!match[6]) {
    if (date.getFullYear() !== Number(match[1].slice(0, 4)) ||
        date.getMonth() + 1 !== Number(match[1].slice(5, 7)) ||
        date.getDate() !== Number(match[1].slice(8, 10)) ||
        date.getHours() !== hours || date.getMinutes() !== minutes ||
        date.getSeconds() !== seconds) return null;
  }
  return date;
}

export function calendarDayForTimestamp(raw: string | null | undefined): string | null {
  const timestamp = parseLocalCalendarDatetime(raw);
  return timestamp ? localDateISO(timestamp) : null;
}

/** Month grid dates must never use toISOString(), which shifts local days in UTC. */
export function monthCellDate(year: number, monthIndex: number, day: number): string {
  return localDateISO(new Date(year, monthIndex, day, 12));
}
