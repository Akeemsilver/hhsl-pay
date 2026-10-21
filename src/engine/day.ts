import { isWeekend } from "./dates";
import type { DayEntry, DayPay, RoleRates, SiteRates, SiteTable } from "./types";

export function findSite(sites: SiteTable, name: string): SiteRates | undefined {
  const wanted = name.trim().toLowerCase();
  for (const [key, site] of Object.entries(sites)) {
    if (key.trim().toLowerCase() === wanted) return site;
  }
  return undefined;
}

const cap = (n: number | undefined) => (n && n > 0 ? n : 0);

export function findRole(site: SiteRates, name: string | undefined): RoleRates | undefined {
  if (!name || !site.roles) return undefined;
  const wanted = name.trim().toLowerCase();
  for (const [key, role] of Object.entries(site.roles)) {
    if (key.trim().toLowerCase() === wanted) return role;
  }
  return undefined;
}

export function computeDay(entry: DayEntry, sites: SiteTable): DayPay {
  const site = findSite(sites, entry.site);
  const empty: DayPay = { rate: 0, tierHours: { x1: 0, x15: 0, x2: 0, x3: 0 }, dailyPay: 0, total: 0 };
  if (!site) return empty;

  // Flat daily-pay sites (yard, offshore) pay for the day even when no hours are logged.
  const hours = entry.hours > 0 ? entry.hours : 0;
  const role = findRole(site, entry.role);
  const lead = !!entry.lead && !role;

  let rate = 0;
  if (cap(site.showRateAboveHrs) > 0) {
    rate = hours > cap(site.showRateAboveHrs) ? (site.rateAboveHrs ?? 0) : 0;
  } else {
    rate = (role?.rate ?? (lead ? site.leadRate : site.baseRate)) ?? 0;
  }

  const caps = entry.holiday
    ? site.holiday
    : (entry.weekend ?? isWeekend(entry.date))
      ? site.weekend
      : site.weekday;

  const c1 = cap(caps.x1);
  const c15 = cap(caps.x15);
  const c2 = cap(caps.x2);
  // Triple time only exists on holidays.
  const c3 = entry.holiday ? cap(caps.x3) : 0;

  const x1 = Math.min(hours, c1);
  const x15 = Math.min(Math.max(0, hours - c1), c15);
  const x2 = Math.min(Math.max(0, hours - c1 - c15), c2);
  const x3 = Math.min(Math.max(0, hours - c1 - c15 - c2), c3);

  let dailyPay = 0;
  const holidayDaily = cap(role?.dailyHoliday) || cap(site.dailyHoliday);
  if (entry.holiday && holidayDaily > 0) dailyPay = holidayDaily;
  else if (cap(role?.dailyPay) > 0) dailyPay = cap(role?.dailyPay);
  else if (lead && cap(site.dailyLead) > 0) dailyPay = cap(site.dailyLead);
  else if (cap(site.dailyStd) > 0) dailyPay = cap(site.dailyStd);

  const overtime = x15 * rate * 1.5 + x2 * rate * 2 + x3 * rate * 3;
  const total = dailyPay > 0 ? dailyPay + overtime : x1 * rate + overtime;

  if (hours === 0 && dailyPay === 0) return empty;
  return { rate, tierHours: { x1, x15, x2, x3 }, dailyPay, total };
}
