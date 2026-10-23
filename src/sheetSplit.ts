import { COMBINED_PAYER, findSite, valueOn, weightedHours, type MonthResult, type PayerMonth } from "./engine";
import { isOther, otherHours, otherPayerId, type AppData, type Entry } from "./model";
import { matchRule } from "./timesheet";

/** The jobs that go on the time sheet: only their days are shown (their hours are paid by the fixed rate or by payroll). */
export interface SheetInfo { days: number; sites: string[] }

export interface SplitResult {
  /** Each payslip group with its days and paid hours, without the jobs that are on the time sheet. */
  payers: PayerMonth[];
  sheet?: SheetInfo;
  /** Every day counted once: the group days plus the time sheet days. */
  totalDays: number;
  /** The paid hours of all groups (the time sheet jobs have none here). */
  totalHours: number;
}

/**
 * Splits the month into lines that add up. A job on the time sheet counts as a day on the Time sheet line and its hours
 * leave its group. A day with several kinds of jobs is counted once: on the Time sheet line if any job that day is on
 * the time sheet, otherwise on the group where the most hours were worked.
 */
export function sheetSplit(result: MonthResult<Entry>, data: AppData, opts: { others?: boolean } = {}): SplitResult {
  const rules = data.timesheet?.rules ?? [];
  const medic = data.timesheet?.medicEverywhere !== false;
  const combined = result.payers.length === 1 && result.payers[0]!.payer === COMBINED_PAYER;
  const payerOf = (e: Entry) => combined ? COMBINED_PAYER : (findSite(valueOn(data.history.sites, e.date), e.site)?.payer ?? "main");
  const otherPayer = combined ? COMBINED_PAYER : otherPayerId(data);

  const jobs = result.entries.filter((e) => !isOther(e.entry) && (e.pay.total > 0 || e.entry.hours > 0));
  const onSheet = jobs.filter((e) => matchRule(e.entry, rules, false, medic));
  const sheetSet = new Set(onSheet);
  const others = opts.others === false ? [] : data.entries.filter((e) => isOther(e) && e.date.startsWith(result.month));
  const othersOnSheet = data.timesheet?.includeOther === false ? [] : others;
  const sheetOthers = new Set(othersOnSheet);
  const paidOthersStaying = others.filter((e) => !sheetOthers.has(e) && (e.amount ?? 0) > 0);

  // Who claims each date.
  const claims = new Map<string, { sheet: boolean; hours: Map<string, number> }>();
  const claim = (date: string) => { const c = claims.get(date) ?? { sheet: false, hours: new Map() }; claims.set(date, c); return c; };
  for (const e of jobs) {
    if (sheetSet.has(e)) { claim(e.entry.date).sheet = true; continue; }
    if (e.pay.total <= 0) continue;
    const c = claim(e.entry.date), p = payerOf(e.entry);
    c.hours.set(p, (c.hours.get(p) ?? 0) + weightedHours(e.pay, e.entry.hours));
  }
  for (const e of othersOnSheet) claim(e.date).sheet = true;
  for (const e of paidOthersStaying) { const c = claim(e.date); c.hours.set(otherPayer, (c.hours.get(otherPayer) ?? 0) + otherHours(e)); }

  const days = new Map<string, number>();
  let sheetDays = 0;
  for (const c of claims.values()) {
    if (c.sheet) { sheetDays++; continue; }
    const best = [...c.hours.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) days.set(best[0], (days.get(best[0]) ?? 0) + 1);
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const paidOthersOnSheet = othersOnSheet.filter((e) => (e.amount ?? 0) > 0);
  const payers = result.payers.map((p) => {
    const gone = onSheet.filter((e) => payerOf(e.entry) === p.payer).reduce((t, e) => t + weightedHours(e.pay, e.entry.hours), 0)
      + (p.payer === otherPayer ? paidOthersOnSheet.reduce((t, e) => t + otherHours(e), 0) : 0);
    return { ...p, days: days.get(p.payer) ?? 0, weighted: Math.max(0, r2(p.weighted - gone)) };
  });
  const names = [...new Set(onSheet.map((e) => e.entry.site))].sort((a, b) => a.localeCompare(b));
  const hasSheet = sheetDays > 0;
  return {
    payers,
    sheet: hasSheet ? { days: sheetDays, sites: othersOnSheet.length ? [...names, "Other jobs"] : names } : undefined,
    totalDays: claims.size,
    totalHours: r2(payers.reduce((t, p) => t + p.weighted, 0)),
  };
}
