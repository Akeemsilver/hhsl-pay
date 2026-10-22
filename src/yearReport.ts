import { COMBINED_PAYER, findSite, valueOn, type MonthResult } from "./engine";
import { otherIncome, otherPayerId, payerLabel, type AppData, type Entry } from "./model";
import { siteBreakdown } from "./payslip";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface YearMonth {
  month: string;
  gross: number;
  /** null when it cannot be told: the month's tax was worked out on all payslips together. */
  net: number | null;
  paye: number | null;
  nis: number | null;
  surcharge: number | null;
  days: number;
  /** Hours worked. */
  hours: number;
  /** Hours paid for, counting overtime at its multiple (an hour at x1.5 counts as 1.5). */
  weighted: number;
  topSite: string | null;
}

export interface YearSection {
  id: string;
  title: string;
  months: YearMonth[];
}

export interface SiteMonth { days: number; hours: number; weighted: number; amount: number }
export interface YearSite {
  site: string;
  group: string;
  days: number;
  hours: number;
  weighted: number;
  amount: number;
  byMonth: SiteMonth[];
}

export interface YearReport {
  all: YearSection;
  groups: YearSection[];
  sites: YearSite[];
}

const emptyMonth = (month: string): YearMonth => ({ month, gross: 0, net: 0, paye: 0, nis: 0, surcharge: 0, days: 0, hours: 0, weighted: 0, topSite: null });

/** The payslip group of one job, from the sites as they were on its day. */
export function groupOf(data: AppData, e: Entry): string {
  return findSite(valueOn(data.history.sites, e.date), e.site)?.payer ?? "main";
}

function topSiteOf(rows: Array<{ label: string; days: number; hours: number }>): string | null {
  const best = [...rows].sort((a, b) => b.days - a.days || b.hours - a.hours || a.label.localeCompare(b.label))[0];
  return best ? best.label : null;
}

/**
 * Everything the Year tab shows, worked out from the twelve months already priced: totals for all sites, one section
 * for each payslip group (the way the yearly spreadsheet is laid out), and every site with its days, hours and pay.
 * `includeOther` leaves out other jobs, for when the screen is limited to one location.
 */
export function yearReport(months: Array<MonthResult<Entry>>, data: AppData, includeOther = true): YearReport {
  const otherGroup = otherPayerId(data);
  const groupIds = new Set<string>(Object.keys(data.payerNames));
  for (const m of months) for (const { entry } of m.entries) groupIds.add(groupOf(data, entry));

  const all: YearMonth[] = [];
  const byGroup = new Map<string, YearMonth[]>([...groupIds].map((g) => [g, []]));
  const siteMap = new Map<string, YearSite>();

  months.forEach((m, mi) => {
    const extras = includeOther ? otherIncome(data, m.month) : [];
    const combined = m.payers.some((p) => p.payer === COMBINED_PAYER);
    const slices = new Map<string, { entries: typeof m.entries; extras: typeof extras }>([...groupIds].map((g) => [g, { entries: [], extras: [] }]));
    for (const pe of m.entries) slices.get(groupOf(data, pe.entry))?.entries.push(pe);
    for (const x of extras) slices.get(otherGroup)?.extras.push(x);

    const stats = (entries: typeof m.entries, ex: typeof extras) => {
      const rows = siteBreakdown(entries);
      const dates = new Set([...entries.map((e) => e.entry.date), ...ex.map((x) => x.date)]);
      const exHours = ex.reduce((t, x) => t + x.hours, 0);
      return {
        days: dates.size,
        hours: round2(rows.reduce((t, r) => t + r.hours, 0) + exHours),
        weighted: round2(rows.reduce((t, r) => t + r.weighted, 0) + exHours),
        gross: round2(entries.reduce((t, e) => t + e.pay.total, 0) + ex.reduce((t, x) => t + x.amount, 0)),
        topSite: topSiteOf(rows),
      };
    };

    const total = stats(m.entries, extras);
    all.push({ month: m.month, gross: m.gross, net: m.net, paye: m.paye, nis: m.nis, surcharge: m.surcharge, days: total.days, hours: total.hours, weighted: total.weighted, topSite: total.topSite });

    for (const [g, slice] of slices) {
      const s = stats(slice.entries, slice.extras);
      const pm = m.payers.find((p) => p.payer === g);
      const row: YearMonth = pm
        ? { month: m.month, gross: pm.gross, net: pm.net, paye: pm.paye, nis: pm.nis, surcharge: pm.surcharge, days: s.days, hours: s.hours, weighted: s.weighted, topSite: s.topSite }
        : combined
          ? { month: m.month, gross: s.gross, net: null, paye: null, nis: null, surcharge: null, days: s.days, hours: s.hours, weighted: s.weighted, topSite: s.topSite }
          : { ...emptyMonth(m.month), days: s.days, hours: s.hours, weighted: s.weighted, topSite: s.topSite };
      byGroup.get(g)?.push(row);
    }

    for (const b of siteBreakdown(m.entries)) {
      const key = b.label.toLowerCase();
      const group = groupOf(data, m.entries.find((e) => e.entry.site === b.label)!.entry);
      const site = siteMap.get(key) ?? { site: b.label, group, days: 0, hours: 0, weighted: 0, amount: 0, byMonth: Array.from({ length: 12 }, () => ({ days: 0, hours: 0, weighted: 0, amount: 0 })) };
      site.days += b.days; site.hours += b.hours; site.weighted += b.weighted; site.amount += b.amount;
      site.byMonth[mi] = { days: b.days, hours: b.hours, weighted: b.weighted, amount: b.amount };
      siteMap.set(key, site);
    }
    if (extras.length) {
      const hours = round2(extras.reduce((t, x) => t + x.hours, 0));
      const amount = round2(extras.reduce((t, x) => t + x.amount, 0));
      const days = new Set(extras.map((x) => x.date)).size;
      const site = siteMap.get("other jobs") ?? { site: "Other jobs", group: otherGroup, days: 0, hours: 0, weighted: 0, amount: 0, byMonth: Array.from({ length: 12 }, () => ({ days: 0, hours: 0, weighted: 0, amount: 0 })) };
      site.days += days; site.hours += hours; site.weighted += hours; site.amount += amount;
      site.byMonth[mi] = { days, hours, weighted: hours, amount };
      siteMap.set("other jobs", site);
    }
  });

  const groups = [...byGroup.entries()]
    .map(([id, rows]) => ({ id, title: payerLabel(data.payerNames, id), months: rows }))
    .filter((g) => g.months.some((r) => r.gross > 0 || r.days > 0));
  const sites = [...siteMap.values()]
    .map((s) => ({ ...s, hours: round2(s.hours), weighted: round2(s.weighted), amount: round2(s.amount) }))
    .sort((a, b) => b.amount - a.amount || a.site.localeCompare(b.site));
  return { all: { id: "all", title: "All sites", months: all }, groups, sites };
}

/** Running totals across the months, for the "year to date" rows. A month that cannot be told counts as nothing. */
export function runningTotal(values: Array<number | null>): number[] {
  let sum = 0;
  return values.map((v) => { sum += v ?? 0; return round2(sum); });
}
