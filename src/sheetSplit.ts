import { COMBINED_PAYER, findSite, valueOn, weightedHours, type MonthResult, type PayerMonth } from "./engine";
import { isOther, type AppData, type Entry } from "./model";
import { matchRule } from "./timesheet";

/** Days and paid hours of the sites that go on the time sheet, kept apart from their payslip group. */
export interface SheetInfo { days: number; weighted: number; sites: string[] }

/**
 * Sites on the time sheet are paid through payroll, so their days and hours are shown on their own line and taken out
 * of the payslip group they belong to. Pay and tax are not touched: only the days and hours that are shown.
 */
export function sheetSplit(result: MonthResult<Entry>, data: AppData): { payers: PayerMonth[]; sheet?: SheetInfo } {
  const payers = result.payers;
  const rules = data.timesheet?.rules ?? [];
  const medic = data.timesheet?.medicEverywhere !== false;
  const combined = payers.length === 1 && payers[0]!.payer === COMBINED_PAYER;
  const payerOf = (e: Entry) => combined ? COMBINED_PAYER : (findSite(valueOn(data.history.sites, e.date), e.site)?.payer ?? "main");
  const worked = (e: { entry: Entry; pay: { total: number } }) => !isOther(e.entry) && (e.pay.total > 0 || e.entry.hours > 0);
  const onSheet = result.entries.filter((e) => worked(e) && matchRule(e.entry, rules, false, medic));
  if (onSheet.length === 0) return { payers };

  const sheetKeys = new Set(onSheet);
  const sheetDates = new Set(onSheet.map((e) => e.entry.date));
  const sheetW = onSheet.reduce((t, e) => t + weightedHours(e.pay, e.entry.hours), 0);
  const adjusted = payers.map((p) => {
    const mine = onSheet.filter((e) => payerOf(e.entry) === p.payer);
    if (mine.length === 0) return p;
    const w = mine.reduce((t, e) => t + weightedHours(e.pay, e.entry.hours), 0);
    const otherDates = new Set(result.entries.filter((e) => !sheetKeys.has(e) && e.pay.total > 0 && payerOf(e.entry) === p.payer).map((e) => e.entry.date));
    const gone = new Set(mine.map((e) => e.entry.date).filter((d) => !otherDates.has(d))).size;
    return { ...p, days: Math.max(0, p.days - gone), weighted: Math.max(0, Math.round((p.weighted - w) * 100) / 100) };
  });
  return {
    payers: adjusted,
    sheet: { days: sheetDates.size, weighted: Math.round(sheetW * 100) / 100, sites: [...new Set(onSheet.map((e) => e.entry.site))].sort((a, b) => a.localeCompare(b)) },
  };
}
