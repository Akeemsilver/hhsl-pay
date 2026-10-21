import type { TimesheetSettings } from "./timesheet";
import { paidHoursFrom, type DayEntry, type PayerOverride, type RuleHistory, type SiteRates, type TaxRules } from "./engine";

export interface Entry extends DayEntry {
  id: string;
  /** "other" = a job with no site (airport pickup, delivery, drop-off). Logged only, never paid by the app. */
  kind?: "site" | "other";
  /** What the other job was. */
  description?: string;
  /** "HH:MM" start and end. Optional for an other job; for a job they work out the paid hours. */
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

/** Re-works the paid hours from the entry's times and lunch; untimed entries keep their typed hours. */
export function withComputedHours(e: Entry): Entry {
  const h = paidHoursFrom(e);
  return h === undefined ? e : { ...e, hours: h };
}
