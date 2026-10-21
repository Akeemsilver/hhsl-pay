import { computeDay, computeMonth, findSite, valueOn, type RuleHistory } from "./engine";
import { monthOf } from "./engine";
import { overridesFor, isOther, type AppData, type Entry } from "./model";

export interface SiteBreakdown {
  label: string;
  /** Distinct hourly rates (or flat day rates when `flat`), lowest first. */
  rates: number[];
  flat: boolean;
  days: number;
  hours: number;
  x1: number; x15: number; x2: number; x3: number;
  /** Hours counted at the normal rate: x1 + 1.5 x x1.5 + 2 x x2 + 3 x x3. */
  weighted: number;
  amount: number;
}

export function siteBreakdown(entries: Array<{ entry: Entry; pay: ReturnType<typeof computeDay> }>): SiteBreakdown[] {
  const map = new Map<string, SiteBreakdown & { dates: Set<string> }>();
  for (const { entry, pay } of entries) {
    const label = entry.site;
    const b = map.get(label) ?? { label, rates: [], flat: false, days: 0, hours: 0, x1: 0, x15: 0, x2: 0, x3: 0, weighted: 0, amount: 0, dates: new Set<string>() };
    const flat = pay.dailyPay > 0;
    const rate = round2(flat ? pay.dailyPay : pay.rate);
    b.flat ||= flat;
    if (!b.rates.includes(rate)) b.rates.push(rate);
    b.dates.add(entry.date);
    b.hours += entry.hours;
    b.x1 += pay.tierHours.x1; b.x15 += pay.tierHours.x15; b.x2 += pay.tierHours.x2; b.x3 += pay.tierHours.x3;
    b.weighted += pay.tierHours.x1 + 1.5 * pay.tierHours.x15 + 2 * pay.tierHours.x2 + 3 * pay.tierHours.x3;
    b.amount += pay.total;
    map.set(label, b);
  }
  return [...map.values()].map(({ dates, ...b }) => ({
    ...b, days: dates.size, rates: b.rates.sort((x, y) => x - y),
    hours: round2(b.hours), x1: round2(b.x1), x15: round2(b.x15), x2: round2(b.x2), x3: round2(b.x3), weighted: round2(b.weighted), amount: round2(b.amount),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

export interface PayslipLine {
  description: string;
  qty: number;
  unit: "h" | "days" | "";
  /** Hourly rate (including any overtime multiple) or the flat amount. */
  rate: number;
  amount: number;
}

export interface Payslip {
  month: string;
  payer: string;
  payerName: string;
  employee: string;
  lines: PayslipLine[];
  gross: number;
  paye: number;
  nis: number;
  surcharge: number;
  net: number;
  hours: number;
  days: number;
  /** The payslip's own gross or PAYE replaced the calculated figure. */
  corrected: boolean;
  /** Per site (and role) breakdown of hours at each pay multiple. */
  sites: SiteBreakdown[];
  ytd: { gross: number; net: number; paye: number; nis: number; surcharge: number };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The earnings lines for one payer's days: standard hours, overtime tiers and flat day rates, added up by site and rate. */
export function earningsLines(entries: Entry[], history: RuleHistory): PayslipLine[] {
  const lines = new Map<string, { line: PayslipLine; base: string; order: number }>();
  const add = (base: string, order: number, description: string, qty: number, unit: PayslipLine["unit"], rate: number, amount: number) => {
    if (!(amount > 0) && !(qty > 0)) return;
    const key = `${description}|${rate}`;
    const entry = lines.get(key) ?? { line: { description, qty: 0, unit, rate, amount: 0 }, base, order };
    entry.line.qty += qty;
    entry.line.amount += amount;
    lines.set(key, entry);
  };

  for (const entry of entries) {
    const sites = valueOn(history.sites, entry.date);
    if (!findSite(sites, entry.site)) continue;
    const pay = computeDay(entry, sites);
    const who = entry.role ? `${entry.site} (${entry.role})` : entry.lead ? `${entry.site} (team lead)` : entry.site;
    const label = entry.holiday ? `${who}, public holiday / TAR` : who;
    if (pay.dailyPay > 0) add(label, 0, `${label}: flat day rate`, 1, "days", pay.dailyPay, pay.dailyPay);
    else add(label, 0, `${label}: standard hours`, pay.tierHours.x1, "h", pay.rate, pay.tierHours.x1 * pay.rate);
    add(label, 1.5, `${label}: overtime x1.5`, pay.tierHours.x15, "h", pay.rate * 1.5, pay.tierHours.x15 * pay.rate * 1.5);
    add(label, 2, `${label}: overtime x2`, pay.tierHours.x2, "h", pay.rate * 2, pay.tierHours.x2 * pay.rate * 2);
    add(label, 3, `${label}: overtime x3`, pay.tierHours.x3, "h", pay.rate * 3, pay.tierHours.x3 * pay.rate * 3);
  }
  return [...lines.values()]
    .sort((a, b) => a.base.localeCompare(b.base) || a.order - b.order || a.line.rate - b.line.rate)
    .map(({ line }) => ({ ...line, qty: round2(line.qty), amount: round2(line.amount) }));
}

/** One payslip for each payslip (payer) that has income in the month. */
export function buildPayslips(month: string, data: AppData, employee: string): Payslip[] {
  const jobs = data.entries.filter((e) => !isOther(e));
  const year = month.slice(0, 4);
  const upTo = Number(month.slice(5));
  const months = Array.from({ length: upTo }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}`;
    return computeMonth(m, jobs, data.history, overridesFor(data, m));
  });
  const current = months[upTo - 1]!;

  return current.payers.map((p) => {
    const mine = current.entries.filter((e) => {
      const site = findSite(valueOn(data.history.sites, e.entry.date), e.entry.site);
      return (site?.payer ?? "main") === p.payer;
    });
    const lines = earningsLines(mine.map((e) => e.entry), data.history);
    const calculated = round2(lines.reduce((s, l) => s + l.amount, 0));
    // A gross typed in from the real payslip replaces the calculated one; show the difference so the lines add up.
    if (Math.abs(p.gross - calculated) > 0.005) {
      lines.push({ description: "Adjustment to match your payslip", qty: 1, unit: "", rate: round2(p.gross - calculated), amount: round2(p.gross - calculated) });
    }
    const ytd = { gross: 0, net: 0, paye: 0, nis: 0, surcharge: 0 };
    for (const m of months) {
      const mp = m.payers.find((x) => x.payer === p.payer);
      if (!mp) continue;
      ytd.gross += mp.gross; ytd.net += mp.net; ytd.paye += mp.paye; ytd.nis += mp.nis; ytd.surcharge += mp.surcharge;
    }
    return {
      month, payer: p.payer, payerName: data.payerNames[p.payer] ?? p.payer, employee,
      lines, sites: siteBreakdown(mine), gross: p.gross, paye: p.paye, nis: p.nis, surcharge: p.surcharge, net: p.net,
      hours: mine.reduce((s, e) => s + e.entry.hours, 0),
      days: new Set(mine.filter((e) => e.pay.total > 0).map((e) => e.entry.date)).size,
      corrected: p.corrected,
      ytd,
    };
  }).filter((s) => monthOf(`${s.month}-01`) === month);
}
