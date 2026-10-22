import type { TimesheetSettings } from "./timesheet";
import { paidHoursFrom, type DayEntry, type PayerOverride, type RuleHistory, type SiteRates, type TaxRules } from "./engine";

export interface Entry extends DayEntry {
  id: string;
  /** "other" = a job with no site (airport pickup, delivery, drop-off). Logged only, never paid by the app. */
  kind?: "site" | "other";
  /** What the other job was. */
  description?: string;
  /** true = Detailed: paid hours are worked out from start/end and lunch. false = Simple: hours are typed. Unset: Detailed only if times were entered. */
  detailed?: boolean;
  /** "HH:MM" start and end. Optional for an other job; in Detailed mode they work out the paid hours. */
  startTime?: string;
  endTime?: string;
  /** Lunch was paid, so no time is taken off. When false or unset, lunchMinutes comes off. */
  lunchPaid?: boolean;
  /** Minutes of unpaid lunch, 30 or 60 (60 when unset). */
  lunchMinutes?: number;
  /** Amount paid, kept as a note. It is never added to pay totals. */
  amount?: number;
}

/** Roles offered on every site. A site can give each one its own rate; without one the site's standard rate is used. */
export const DEFAULT_ROLES = ["Client medic", "Offshore", "Paramedic"] as const;

/** Default roles plus any custom roles defined on the site. */
export function rolesFor(site: SiteRates | undefined): string[] {
  const out: string[] = [...DEFAULT_ROLES];
  for (const r of Object.keys(site?.roles ?? {})) {
    if (!out.some((x) => x.toLowerCase() === r.toLowerCase())) out.push(r);
  }
  return out;
}

export const isOther = (e: Entry): boolean => e.kind === "other";

/** Other jobs in a month, grouped by date. */
export function othersByDate(entries: Entry[], month: string): Map<string, Entry[]> {
  const out = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!isOther(e) || !e.date.startsWith(month)) continue;
    out.set(e.date, [...(out.get(e.date) ?? []), e]);
  }
  return out;
}

export interface AppData {
  version: 1;
  history: RuleHistory;
  entries: Entry[];
  /** Display names for payers, e.g. { main: "Main payslip" }. */
  payerNames: Record<string, string>;
  /** Actual payslip figures where they differ from the calculation, keyed "YYYY-MM|payer". */
  corrections?: Record<string, PayerOverride>;
  /** Name, header text and which jobs go on the payroll timesheet. */
  timesheet?: TimesheetSettings;
  /** Edits to the built-in public holiday list. */
  holidays?: { added: { date: string; name: string }[]; removed: string[] };
  /** The name shown on payslips and timesheets. */
  userName?: string;
  /** The person chose to set up their sites by hand instead of loading a starter kit. */
  setupSkipped?: boolean;
  /** Which payslip group other jobs are paid on and taxed with. */
  otherPayer?: string;
  /** Whether PAYE, NIS and the surcharge are worked out per payslip group (split) or on everything together, from a month on. */
  taxMode?: Array<{ effectiveFrom: string; combined: boolean }>;
  /** Chosen calendar colour (0–11) per site, keyed by lower-case site name. Sites without one get an automatic colour. */
  siteColors?: Record<string, number>;
  lastBackupAt?: string;
}

export function correctionKey(month: string, payer: string): string {
  return `${month}|${payer}`;
}

/** The corrections that apply to one month, keyed by payer. */
export function overridesFor(data: AppData, month: string): Record<string, PayerOverride> {
  const out: Record<string, PayerOverride> = {};
  for (const [key, value] of Object.entries(data.corrections ?? {})) {
    const [m, payer] = key.split("|");
    if (m === month && payer) out[payer] = value;
  }
  return out;
}

export const FIRST_VERSION_DATE = "2000-01-01";

/** Trinidad & Tobago PAYE / NIS / health-surcharge rules as used in the source sheet. */
export const defaultTax: TaxRules = {
  monthlyAllowance: 7500,
  rate: 0.25,
  annualThreshold: 90000,
  nisRelief: 0.7,
  nisBands: [
    [0, 0],
    [867, 14.6],
    [1473, 21.3],
    [1950, 28.6],
    [2643, 37],
    [3293, 45.6],
    [4030, 55.4],
    [4853, 65.3],
    [5633, 75.3],
    [6457, 86.4],
    [7410, 97.7],
    [8277, 109.4],
    [9273, 122],
    [10313, 135.3],
    [11397, 149.9],
    [12653, 163.6],
    [13600, 169.5],
  ],
  surchargeBands: [
    [0, 0],
    [0.01, 19.2],
    [470, 33],
  ],
  fiveMondayFactor: 1.25,
};

export function emptySite(payer = "main"): SiteRates {
  return { payer, weekday: {}, weekend: {}, holiday: {} };
}

export function newData(): AppData {
  return {
    version: 1,
    history: {
      sites: [{ effectiveFrom: FIRST_VERSION_DATE, value: {} }],
      tax: [{ effectiveFrom: FIRST_VERSION_DATE, value: defaultTax }],
    },
    entries: [],
    payerNames: { main: "Main payslip" },
  };
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Detailed jobs work out their hours from times; Simple jobs keep the hours that were typed. */
export function isDetailed(e: Entry): boolean {
  return e.detailed ?? !!(e.startTime || e.endTime);
}

/** Re-works the paid hours of a Detailed job from its times and lunch (0 until both times are set). Simple jobs are left alone. */
export function withComputedHours(e: Entry): Entry {
  if (isOther(e)) return e.startTime && e.endTime ? { ...e, hours: otherHours(e) } : e;
  if (!isDetailed(e)) return e;
  return { ...e, hours: paidHoursFrom(e) ?? 0 };
}

/** Pressing Detailed clears the hours: they now come from the start and end time. */
export function toDetailed(e: Entry): Entry {
  return withComputedHours({ ...e, detailed: true, hours: 0 });
}

/** Back to Simple: keep the hours as they are and drop the times. */
export function toSimple(e: Entry): Entry {
  return { ...e, detailed: false, startTime: undefined, endTime: undefined };
}

export function userNameOf(data: Pick<AppData, "userName" | "timesheet">): string {
  return (data.userName || data.timesheet?.name || "").trim();
}

/** Timesheet settings with the app-wide user name filled in. */
export function timesheetSettingsOf(data: Pick<AppData, "userName" | "timesheet">): TimesheetSettings {
  const t = data.timesheet ?? { name: "", siteLabel: "ERT Offsite", rules: [] };
  return { ...t, name: userNameOf(data) };
}

/** Is tax worked out on all income together in this month? Split is the default. */
export function isCombined(data: Pick<AppData, "taxMode">, month: string): boolean {
  const on = `${month}-01`;
  let result = false;
  let best = "";
  for (const t of data.taxMode ?? []) {
    if (t.effectiveFrom <= on && t.effectiveFrom >= best) { best = t.effectiveFrom; result = t.combined; }
  }
  return result;
}

const nextMonth = (month: string): string => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** Use split or combined tax from this month onwards. */
export function setTaxModeFrom(data: AppData, month: string, combined: boolean): AppData {
  const list = (data.taxMode ?? []).filter((t) => t.effectiveFrom !== `${month}-01`);
  list.push({ effectiveFrom: `${month}-01`, combined });
  list.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return { ...data, taxMode: list };
}

/** Use split or combined tax for just this one month; later months keep what they had. */
export function setTaxModeForMonth(data: AppData, month: string, combined: boolean): AppData {
  const before = isCombined(data, nextMonth(month));
  const next = nextMonth(month);
  const hasNext = (data.taxMode ?? []).some((t) => t.effectiveFrom === `${next}-01`);
  let out = setTaxModeFrom(data, month, combined);
  if (!hasNext) out = setTaxModeFrom(out, next, before);
  return out;
}

/** The payslip group other jobs belong to: the chosen one, else "main", else the first group. */
export function otherPayerId(data: Pick<AppData, "otherPayer" | "payerNames">): string {
  const names = Object.keys(data.payerNames);
  if (data.otherPayer && names.includes(data.otherPayer)) return data.otherPayer;
  return names.includes("main") ? "main" : (names[0] ?? "main");
}

/** Hours between an other job's start and end time (0 when either is missing). */
export function otherHours(e: Pick<Entry, "startTime" | "endTime" | "hours">): number {
  // Hours typed in by hand count when there are no start and end times to work them out from.
  if (!e.startTime || !e.endTime) return e.hours > 0 ? e.hours : 0;
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let span = m(e.endTime) - m(e.startTime);
  if (span <= 0) span += 24 * 60;
  return Math.round((span / 60) * 100) / 100;
}

/** Other jobs with an amount, as income on the payslip they belong to. */
export function otherIncome(data: Pick<AppData, "entries" | "otherPayer" | "payerNames">, month: string): Array<{ date: string; payer: string; amount: number; hours: number }> {
  const payer = otherPayerId(data);
  return data.entries
    .filter((e) => isOther(e) && e.date.startsWith(month) && (e.amount ?? 0) > 0)
    .map((e) => ({ date: e.date, payer, amount: e.amount ?? 0, hours: otherHours(e) }));
}

/** The name to show for a payslip group: the name you gave it, else its id tidied up ("atlantic" shows as "Atlantic"). */
export function payerLabel(names: Record<string, string>, id: string): string {
  const given = names[id]?.trim();
  if (given) return given;
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
