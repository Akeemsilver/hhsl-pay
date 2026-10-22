import type { ISODate } from "./types";

export function parseISO(date: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Bad date: ${date}`);
  return { y, m, d };
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(date: ISODate): number {
  const { y, m, d } = parseISO(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWeekend(date: ISODate): boolean {
  const wd = weekdayOf(date);
  return wd === 0 || wd === 6;
}

export function mondaysInMonth(year: number, month: number): number {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 1) count++;
  }
  return count;
}

export function monthOf(date: ISODate): string {
  return date.slice(0, 7);
}
