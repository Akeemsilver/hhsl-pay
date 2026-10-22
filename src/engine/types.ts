/** ISO calendar date, e.g. "2026-07-04". */
export type ISODate = string;

/** Hour caps per multiplier tier. A missing cap means no hours fall in that tier. */
export interface TierCaps {
  x1?: number;
  x15?: number;
  x2?: number;
  x3?: number;
}

/** A position at a site (for example client medic) that is paid differently from the site's standard rate. */
export interface RoleRates {
  rate?: number;
  dailyPay?: number;
  dailyHoliday?: number;
  /** Overtime hours just for this role, for example 8 hours at x1 then 4 at x1.5. Missing means the site's own hours. */
  weekday?: TierCaps;
  weekend?: TierCaps;
  holiday?: TierCaps;
}

export interface SiteRates {
  /** Which payslip this site's income lands on; each payer gets its own PAYE/NIS calculation. */
  payer: string;
  /** Does a job here have a lunch check (unpaid lunch taken off)? Yes unless set to false. */
  lunch?: boolean;
  baseRate?: number;
  leadRate?: number;
  /** If set, the hourly rate only applies once hours exceed this; otherwise it is blank (rate 0). */
  showRateAboveHrs?: number;
  rateAboveHrs?: number;
  weekday: TierCaps;
  weekend: TierCaps;
  holiday: TierCaps;
  dailyStd?: number;
  dailyLead?: number;
  dailyHoliday?: number;
  /** Extra positions with their own pay. Overtime hours are the site's unless the role sets its own. */
  roles?: Record<string, RoleRates>;
}

export type SiteTable = Record<string, SiteRates>;

export interface TaxRules {
  /** Tax-free amount per month, before the NIS relief. */
  monthlyAllowance: number;
  rate: number;
  /** Annual gross above which tax is due (used for the year-end estimate). */
  annualThreshold: number;
  /** Share of annualised NIS that is deducted before tax. */
  nisRelief: number;
  /** [gross from, weekly NIS], sorted ascending; the highest band at or below gross applies. */
  nisBands: Array<[number, number]>;
  /** Health surcharge: [gross from, amount] ascending bands. */
  surchargeBands: Array<[number, number]>;
  /** Surcharge multiplier when the month has five Mondays. */
  fiveMondayFactor: number;
}

export interface Dated<T> {
  effectiveFrom: ISODate;
  value: T;
}

/** Everything that can change with a raise or a budget, each with a start date. */
export interface RuleHistory {
  sites: Array<Dated<SiteTable>>;
  tax: Array<Dated<TaxRules>>;
}

export interface DayEntry {
  date: ISODate;
  site: string;
  hours: number;
  lead?: boolean;
  /** A custom role defined on the site, such as "Client medic". Unset means the standard rate (or lead when `lead`). */
  role?: string;
  holiday?: boolean;
  /** Overrides the weekday check, for entries where the sheet flagged a weekend by hand. */
  weekend?: boolean;
}

export interface DayPay {
  rate: number;
  tierHours: { x1: number; x15: number; x2: number; x3: number };
  dailyPay: number;
  total: number;
}
