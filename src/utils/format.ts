// utils/format.ts — display helpers (no business logic).

/** 12345 → "12,345" */
export function formatChips(n: number): string {
  return Math.trunc(n).toLocaleString("en-US");
}

/** Signed profit, e.g. +120 / -60 / ±0 */
export function formatSignedChips(n: number): string {
  const v = Math.trunc(n);
  if (v === 0) return "±0";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toLocaleString("en-US")}`;
}

/** ISO → "2026/06/03 21:04" in local time. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** ISO → "2026/06/03" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}
