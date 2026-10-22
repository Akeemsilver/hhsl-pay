import { minutesBetween } from "./engine";

export function money(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${abs}`;
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y ?? 2000, m ?? 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function hoursText(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0+$/, "");
}

/** "2 h 30 min" between two optional HH:MM times; an end before the start means it ran past midnight. */
export function durationText(start?: string, end?: string): string {
  const diff = minutesBetween(start, end);
  if (diff === null) return "";
  const h = Math.floor(diff / 60), m = diff % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** "08:00–10:30", "from 08:00", "until 10:30", or "". */
export function timeRange(start?: string, end?: string): string {
  if (start && end) return `${start}–${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return "";
}

/**
 * Reads hours as they are typed: "11.5", "9,5", ".5", "11." and "" are fine (the last two count as 0 and 11 for now).
 * Returns null for anything that is not a number up to 24 with at most two decimals.
 */
export function parseHoursInput(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "" || t === ".") return 0;
  if (!/^\d{1,2}(\.\d{0,2})?$|^\.\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n > 24 ? null : n;
}
