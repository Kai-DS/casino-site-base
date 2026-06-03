// utils/date.ts — date logic centralised here so it can later move to server time.
// See spec §5.4 (daily bonus / rescue cooldown).

/** Local calendar day as YYYY-MM-DD (NOT UTC — daily bonus uses the device's day). */
export function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True when `lastClaimedAt` (a YYYY-MM-DD key, or null) is not today. */
export function isNewLocalDay(lastClaimedAt: string | null, now: Date = new Date()): boolean {
  if (!lastClaimedAt) return true;
  return lastClaimedAt !== localDayKey(now);
}

/** Milliseconds elapsed since an ISO timestamp (Infinity if null/invalid). */
export function msSince(iso: string | null, now: Date = new Date()): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return now.getTime() - t;
}

export const MINUTE_MS = 60_000;

/** Whole minutes remaining in a cooldown, or 0 when ready. */
export function cooldownRemainingMinutes(
  lastAt: string | null,
  cooldownMs: number,
  now: Date = new Date(),
): number {
  const remaining = cooldownMs - msSince(lastAt, now);
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / MINUTE_MS);
}
