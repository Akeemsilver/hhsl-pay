import { findSite, isWeekend, valueOn, weightedHours, type MonthResult } from "./engine";
import { isFixedDay, isOther, otherHours, type AppData, type Entry } from "./model";

/** One line of the month by site: money, days, and the hours worked and paid (hours are left out for a fixed day rate). */
export interface SiteRow {
  site: string;
  income: number;
  days: number;
  weekdays: number;
  /** Weekend or holiday days. */
  offdays: number;
  worked?: number;
  total?: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The month broken down by site, like the monthly sheet: income, days (weekdays and weekend/holiday days), hours worked
 * and the same hours with the overtime multiples counted. A fixed day rate site has no hours. Paid other jobs are one more line.
 */
export function siteTable(result: MonthResult<Entry>, data: AppData, opts: { others?: boolean } = {}): { rows: SiteRow[]; all: SiteRow } {
  const lastSites = valueOn(data.history.sites, `${result.month}-28`);
  const order = Object.keys(lastSites);
  type Acc = { income: number; dates: Map<string, boolean>; worked: number; total: number; hourly: boolean };
  const by = new Map<string, Acc>();
  const allDates = new Map<string, boolean>();
  const touch = (name: string): Acc => { const a = by.get(name) ?? { income: 0, dates: new Map(), worked: 0, total: 0, hourly: false }; by.set(name, a); return a; };

  for (const { entry, pay } of result.entries) {
    const a = touch(entry.site);
    const off = !!entry.holiday || (entry.weekend ?? isWeekend(entry.date));
    a.income += pay.total;
    if (pay.total > 0) { a.dates.set(entry.date, off); allDates.set(entry.date, off); }
    if (!isFixedDay(findSite(valueOn(data.history.sites, entry.date), entry.site))) {
      a.hourly = true; a.worked += entry.hours; a.total += weightedHours(pay, entry.hours);
    }
  }
  if (opts.others !== false) {
    for (const e of data.entries) {
      if (!isOther(e) || !e.date.startsWith(result.month) || !((e.amount ?? 0) > 0)) continue;
      const a = touch("Other jobs");
      const off = isWeekend(e.date);
      a.income += e.amount ?? 0; a.dates.set(e.date, off); allDates.set(e.date, off);
      a.hourly = true; a.worked += otherHours(e); a.total += otherHours(e);
    }
  }

  const row = (site: string, a: Acc): SiteRow => {
    const offdays = [...a.dates.values()].filter(Boolean).length;
    return { site, income: r2(a.income), days: a.dates.size, weekdays: a.dates.size - offdays, offdays, worked: a.hourly ? r2(a.worked) : undefined, total: a.hourly ? r2(a.total) : undefined };
  };
  const names = [...order.filter((n) => by.has(n)), ...[...by.keys()].filter((n) => !order.includes(n) && n !== "Other jobs"), ...(by.has("Other jobs") ? ["Other jobs"] : [])];
  const rows = names.filter((n) => { const a = by.get(n)!; return a.income > 0 || a.dates.size > 0 || a.worked > 0; }).map((n) => row(n, by.get(n)!));
  const offAll = [...allDates.values()].filter(Boolean).length;
  const hourly = rows.filter((r) => r.worked !== undefined);
  const all: SiteRow = {
    site: "All sites",
    income: r2(rows.reduce((t, r) => t + r.income, 0)),
    days: allDates.size, weekdays: allDates.size - offAll, offdays: offAll,
    worked: hourly.length ? r2(hourly.reduce((t, r) => t + r.worked!, 0)) : undefined,
    total: hourly.length ? r2(hourly.reduce((t, r) => t + r.total!, 0)) : undefined,
  };
  return { rows, all };
}
