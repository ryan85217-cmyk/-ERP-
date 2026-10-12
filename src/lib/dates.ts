// Store timezone helpers. Taiwan has a fixed UTC+8 offset (no DST),
// so calendar boundaries can be computed with simple arithmetic.

export const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_MS = 86_400_000;

/** Shift a UTC instant into "local wall clock" expressed as a UTC Date. */
function toLocal(d: Date) {
  return new Date(d.getTime() + TZ_OFFSET_MS);
}
function fromLocal(d: Date) {
  return new Date(d.getTime() - TZ_OFFSET_MS);
}

export function startOfDay(d: Date = new Date()) {
  const l = toLocal(d);
  return fromLocal(new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate())));
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Monday-based week start */
export function startOfWeek(d: Date = new Date()) {
  const s = startOfDay(d);
  const dow = toLocal(s).getUTCDay(); // 0=Sun
  const diff = (dow + 6) % 7;
  return addDays(s, -diff);
}

export function startOfMonth(d: Date = new Date()) {
  const l = toLocal(d);
  return fromLocal(new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1)));
}

export function addMonths(d: Date, months: number) {
  const l = toLocal(d);
  return fromLocal(
    new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + months, l.getUTCDate(), l.getUTCHours(), l.getUTCMinutes())),
  );
}

export function startOfYear(d: Date = new Date()) {
  const l = toLocal(d);
  return fromLocal(new Date(Date.UTC(l.getUTCFullYear(), 0, 1)));
}

export function localParts(d: Date) {
  const l = toLocal(d);
  return {
    year: l.getUTCFullYear(),
    month: l.getUTCMonth() + 1,
    day: l.getUTCDate(),
    hour: l.getUTCHours(),
    weekday: l.getUTCDay(),
  };
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function dayKey(d: Date) {
  const p = localParts(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function monthKey(d: Date) {
  const p = localParts(d);
  return `${p.year}-${pad2(p.month)}`;
}

export type RangeKey = "today" | "7d" | "30d" | "year";

export const RANGE_KEYS: RangeKey[] = ["today", "7d", "30d", "year"];

export function parseRange(value: string | undefined): RangeKey {
  return value === "today" || value === "7d" || value === "30d" || value === "year" ? value : "30d";
}

export function rangeBounds(range: RangeKey, now: Date = new Date()) {
  const today = startOfDay(now);
  const end = addDays(today, 1);
  switch (range) {
    case "today":
      return { start: today, end };
    case "7d":
      return { start: addDays(today, -6), end };
    case "30d":
      return { start: addDays(today, -29), end };
    case "year":
      return { start: startOfYear(now), end };
  }
}

/** Previous period of identical length, for deltas */
export function previousBounds(start: Date, end: Date) {
  const len = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - len), end: start };
}
