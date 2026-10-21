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
  if (isOther(e) || !isDetailed(e)) return e;
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
