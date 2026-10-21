import { computeDay } from "./day";
import { findSite } from "./day";
import { mondaysInMonth, monthOf, parseISO } from "./dates";
import { valueOn } from "./rules";
import { monthTax, type MonthTax } from "./tax";
import type { DayEntry, DayPay, RuleHistory } from "./types";

export interface PricedEntry {
  entry: DayEntry;
  pay: DayPay;
}

export interface PayerMonth extends MonthTax {
  payer: string;
  hours: number;
}

export interface MonthResult {
  month: string;
  entries: PricedEntry[];
  payers: PayerMonth[];
  gross: number;
  net: number;
  paye: number;
  nis: number;
  surcharge: number;
}

/** Each entry is priced with the rules in force on its own date, so a raise never touches earlier days. */
export function computeMonth(month: string, allEntries: DayEntry[], history: RuleHistory): MonthResult {
  const { y, m } = parseISO(`${month}-01`);
  const mondays = mondaysInMonth(y, m);
  const entries: PricedEntry[] = allEntries
    .filter((e) => monthOf(e.date) === month)
    .map((entry) => ({ entry, pay: computeDay(entry, valueOn(history.sites, entry.date)) }));

  const byPayer = new Map<string, { gross: number; hours: number }>();
  for (const { entry, pay } of entries) {
    const site = findSite(valueOn(history.sites, entry.date), entry.site);
    const payer = site?.payer ?? "main";
    const acc = byPayer.get(payer) ?? { gross: 0, hours: 0 };
    acc.gross += pay.total;
    acc.hours += entry.hours;
    byPayer.set(payer, acc);
  }

  // Tax rules are taken as of the last day of the month.
  const lastDay = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const rules = valueOn(history.tax, lastDay);

  const payers: PayerMonth[] = [...byPayer.entries()].map(([payer, { gross, hours }]) => ({
    payer,
    hours,
    ...monthTax(gross, mondays, rules),
  }));

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
