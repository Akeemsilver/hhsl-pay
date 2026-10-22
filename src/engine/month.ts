import { computeDay } from "./day";
import { findSite } from "./day";
import { mondaysInMonth, monthOf, parseISO } from "./dates";
import { valueOn } from "./rules";
import { monthTax, type MonthTax } from "./tax";
import type { DayEntry, DayPay, RuleHistory } from "./types";

/** Money earned outside the sites table (other jobs): added to a payslip's gross and taxed with it. */
export interface ExtraIncome {
  date: string;
  payer: string;
  amount: number;
  hours: number;
}

/** The payer id used when every site is taxed together. */
export const COMBINED_PAYER = "all";

/** The hours of a priced day with the overtime multiples counted in. A day with no tiers (flat pay) counts its hours as they are. */
export function weightedHours(pay: DayPay, hours: number): number {
  const t = pay.tierHours;
  const w = t.x1 + 1.5 * t.x15 + 2 * t.x2 + 3 * t.x3;
  return t.x1 + t.x15 + t.x2 + t.x3 > 0 ? w : hours;
}

export interface PricedEntry<E extends DayEntry = DayEntry> {
  entry: E;
  pay: DayPay;
}

export interface PayerMonth extends MonthTax {
  payer: string;
  hours: number;
  /** Hours counted at the normal rate: 1.5x hours count 1.5, double time 2, triple time 3 (other jobs count as they are). */
  weighted: number;
  /** Days worked on this payslip (a day with pay, or an other job). */
  days: number;
  /** True when the payslip's actual gross or PAYE replaced the calculated figure. */
  corrected: boolean;
}

/** What a payslip actually says, when it differs from the calculation. */
export interface PayerOverride {
  gross?: number;
  paye?: number;
}

export interface MonthResult<E extends DayEntry = DayEntry> {
  month: string;
  entries: Array<PricedEntry<E>>;
  payers: PayerMonth[];
  gross: number;
  net: number;
  paye: number;
  nis: number;
  surcharge: number;
}

/** Each entry is priced with the rules in force on its own date, so a raise never touches earlier days. */
export function computeMonth<E extends DayEntry>(
  month: string,
  allEntries: E[],
  history: RuleHistory,
  overrides: Record<string, PayerOverride> = {},
  /** Tax everything together as one payer ("all") instead of each payslip group on its own. */
  combined = false,
  extras: ExtraIncome[] = [],
): MonthResult<E> {
  const { y, m } = parseISO(`${month}-01`);
  const mondays = mondaysInMonth(y, m);
  const entries: Array<PricedEntry<E>> = allEntries
    .filter((e) => monthOf(e.date) === month)
    .map((entry) => ({ entry, pay: computeDay(entry, valueOn(history.sites, entry.date)) }));

  const byPayer = new Map<string, { gross: number; hours: number; weighted: number; dates: Set<string> }>();
  for (const { entry, pay } of entries) {
    const site = findSite(valueOn(history.sites, entry.date), entry.site);
    const payer = combined ? COMBINED_PAYER : (site?.payer ?? "main");
    const acc = byPayer.get(payer) ?? { gross: 0, hours: 0, weighted: 0, dates: new Set<string>() };
    acc.gross += pay.total;
    acc.hours += entry.hours;
    acc.weighted += weightedHours(pay, entry.hours);
    if (pay.total > 0) acc.dates.add(entry.date);
    byPayer.set(payer, acc);
  }

  for (const x of extras) {
    if (monthOf(x.date) !== month || !(x.amount > 0)) continue;
    const payer = combined ? COMBINED_PAYER : x.payer;
    const acc = byPayer.get(payer) ?? { gross: 0, hours: 0, weighted: 0, dates: new Set<string>() };
    acc.gross += x.amount;
    acc.hours += x.hours;
    acc.weighted += x.hours;
    acc.dates.add(x.date);
    byPayer.set(payer, acc);
  }

  // Tax rules are taken as of the last day of the month.
  const lastDay = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const rules = valueOn(history.tax, lastDay);

  // A payer with a correction is shown even when no days were logged for it.
  for (const [payer, o] of Object.entries(overrides)) {
    if (!byPayer.has(payer) && ((o.gross ?? 0) > 0 || o.paye !== undefined)) byPayer.set(payer, { gross: 0, hours: 0, weighted: 0, dates: new Set<string>() });
  }

  const payers: PayerMonth[] = [...byPayer.entries()].map(([payer, { gross: calculated, hours, weighted, dates }]) => {
    const o = overrides[payer];
    const gross = o?.gross !== undefined && o.gross > 0 ? o.gross : calculated;
    const tax = monthTax(gross, mondays, rules);
    const paye = o?.paye !== undefined ? o.paye : tax.paye;
    return {
      payer,
      hours,
      weighted: Math.round(weighted * 100) / 100,
      days: dates.size,
      corrected: gross !== calculated || (o?.paye !== undefined && o.paye !== tax.paye),
      ...tax,
      paye,
      net: tax.gross - paye - tax.nis - tax.surcharge,
    };
  });

  const sum = (pick: (p: PayerMonth) => number) => payers.reduce((s, p) => s + pick(p), 0);
  return {
    month,
    entries,
    payers,
    gross: sum((p) => p.gross),
    net: sum((p) => p.net),
    paye: sum((p) => p.paye),
    nis: sum((p) => p.nis),
    surcharge: sum((p) => p.surcharge),
  };
}

/**
 * Limits a month to one location. Tax is worked out on the whole payslip, so each payslip's PAYE, NIS and
 * surcharge are shared out by how much of its gross came from this location.
 */
export function filterMonth<E extends DayEntry>(r: MonthResult<E>, site: string, history: RuleHistory): MonthResult<E> {
  const entries = r.entries.filter((e) => e.entry.site === site);
  const combined = r.payers.length === 1 && r.payers[0]!.payer === COMBINED_PAYER;
  const payerOf = (e: E) => combined ? COMBINED_PAYER : (findSite(valueOn(history.sites, e.date), e.site)?.payer ?? "main");
  const payers: PayerMonth[] = [];
  for (const p of r.payers) {
    const mine = entries.filter((e) => payerOf(e.entry) === p.payer);
    const gross = mine.reduce((t, e) => t + e.pay.total, 0);
    if (mine.length === 0) continue;
    const share = p.gross > 0 ? gross / p.gross : 0;
    const paye = p.paye * share, nis = p.nis * share, surcharge = p.surcharge * share;
    payers.push({ ...p, hours: mine.reduce((t, e) => t + e.entry.hours, 0), days: new Set(mine.filter((e) => e.pay.total > 0).map((e) => e.entry.date)).size, weighted: Math.round(mine.reduce((t, e) => t + weightedHours(e.pay, e.entry.hours), 0) * 100) / 100, gross, paye, nis, surcharge, net: gross - paye - nis - surcharge });
  }
  const sum = (pick: (p: PayerMonth) => number) => payers.reduce((t, p) => t + pick(p), 0);
  return { month: r.month, entries, payers, gross: sum((p) => p.gross), net: sum((p) => p.net), paye: sum((p) => p.paye), nis: sum((p) => p.nis), surcharge: sum((p) => p.surcharge) };
}
