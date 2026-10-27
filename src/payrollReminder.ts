import { lastDayOfMonth } from "./backupReminder";
import { MONTHS } from "./format";

/** What the person told the app about one month's payroll: the email was sent, there was nothing to send, or the missed-deadline note was read. */
export type PayrollStatus = "sent" | "none" | "seen";
export interface PayrollData { entries: unknown[]; payrollStatus?: Record<string, PayrollStatus> }

export interface PayrollReminder {
  /** The month whose time sheet goes to payroll ("YYYY-MM"). */
  month: string;
  /** "due": on the last day and the first two days of the next month. "missed": after payroll closed and nothing was confirmed. */
  stage: "due" | "missed";
  /** Payroll closes on the 2nd of the following month. */
  closes: string;
}

function shift(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "October 2026" */
export function monthTitle(month: string): string {
  return `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
}

/** "2 November" */
export function closesText(month: string): string {
  return `2 ${MONTHS[Number(shift(month, 1).slice(5)) - 1]}`;
}

/**
 * The payroll reminder for today, or null. It starts on the last day of the month and carries on through the 1st and 2nd of the
 * next month, until the person says the email was sent (or that there was nothing to send). After payroll has closed (3rd to 10th)
 * a month that was never confirmed is shown once as a note. Nothing shows before anything is logged.
 */
export function payrollReminderFor(d: PayrollData, todayIso: string): PayrollReminder | null {
  if (d.entries.length === 0) return null;
  const month = todayIso.slice(0, 7);
  const day = Number(todayIso.slice(8));
  let target: string | null = null;
  let stage: PayrollReminder["stage"] = "due";
  if (todayIso === lastDayOfMonth(month)) target = month;
  else if (day <= 2) target = shift(month, -1);
  else if (day <= 10) { target = shift(month, -1); stage = "missed"; }
  if (!target || d.payrollStatus?.[target]) return null;
  return { month: target, stage, closes: closesText(target) };
}
