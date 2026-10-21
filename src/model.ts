import type { DayEntry, PayerOverride, RuleHistory, SiteRates, TaxRules } from "./engine";

export interface Entry extends DayEntry {
  id: string;
}

export interface AppData {
  version: 1;
  history: RuleHistory;
  entries: Entry[];
  /** Display names for payers, e.g. { main: "Main payslip" }. */
  payerNames: Record<string, string>;
  /** Actual payslip figures where they differ from the calculation, keyed "YYYY-MM|payer". */
  corrections?: Record<string, PayerOverride>;
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
