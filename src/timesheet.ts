import { computeDay, findSite, valueOn, type RuleHistory } from "./engine";
import { daysOfMonth } from "./format";
import { isOther, otherHours, type Entry } from "./model";

/** Which jobs go on the payroll timesheet, and what to call the client. */
export interface TimesheetRule {
  site: string;
  /** Only this role; unset matches any role at the site. */
  role?: string;
  /** Text for the CLIENT ASSIGNED column, e.g. "HHSL Compound" or "PLNL Medic". */
  label: string;
}

export interface TimesheetSettings {
  /** Printed in block letters in the header. */
  name: string;
  /** The SITE line in the header, e.g. "ERT Offsite". */
  siteLabel: string;
  rules: TimesheetRule[];
  /** List other jobs (pickups, deliveries) on the timesheet. On unless turned off. */
  includeOther?: boolean;
  /** Client medic jobs at any site go on the timesheet even when the site is not ticked. On unless turned off. */
  medicEverywhere?: boolean;
  /** Where "Send to payroll" addresses the email. */
  payrollEmail?: string;
}

export const DEFAULT_PAYROLL_EMAIL = "payrollassistant@hhslsafety.com";

export const emptyTimesheetSettings = (): TimesheetSettings => ({ name: "", siteLabel: "ERT Offsite", rules: [] });

export interface TimesheetRow {
  date: string;
  onDuty?: string;
  offDuty?: string;
  hours: { t: number; t15: number; t2: number; t3: number };
  client: string;
  entryIds: string[];
}

export interface TimesheetBuild {
  rows: TimesheetRow[];
  warnings: string[];
}

export const CLIENT_MEDIC = "Client medic";

const same = (a: string | undefined, b: string | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export function matchRule(entry: Entry, rules: TimesheetRule[], includeOther = true, medicEverywhere = true): TimesheetRule | undefined {
  // Other jobs go on the timesheet, with what they were (e.g. "Airport run") in the client column.
  if (isOther(entry)) return !includeOther ? undefined : { site: "", label: entry.description?.trim() || "Other job" };
  // A specific role rule wins over an "any role" rule for the same site.
  const roleMatch = rules.find((r) => r.role && same(r.site, entry.site) && same(r.role, entry.role));
  const siteMatch = roleMatch ?? rules.find((r) => !r.role && same(r.site, entry.site));
  if (siteMatch) return siteMatch;
  // Client medic jobs always go on the timesheet, at any site, even with no rule for that site.
  if (medicEverywhere && same(entry.role, CLIENT_MEDIC)) return { site: entry.site, role: CLIENT_MEDIC, label: `${entry.site.trim()} Medic` };
  return undefined;
}

const dayLabel = (iso: string) => `${Number(iso.slice(8))} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(iso.slice(5, 7)) - 1]}`;

/** The timesheet rows for a month: one row per day that has a matching job. */
export function buildTimesheet(month: string, entries: Entry[], history: RuleHistory, rules: TimesheetRule[], includeOther = true, medicEverywhere = true): TimesheetBuild {
  const warnings: string[] = [];
  const byDate = new Map<string, Array<{ entry: Entry; rule: TimesheetRule }>>();
  for (const entry of entries) {
    if (!entry.date.startsWith(month)) continue;
    let rule = matchRule(entry, rules, includeOther, medicEverywhere);
    // A site with a typed-in field (for example a platform) puts what was typed in the Client column.
    const typed = !isOther(entry) && findSite(valueOn(history.sites, entry.date), entry.site)?.roleField ? entry.role?.trim() : "";
    if (rule && typed) rule = { ...rule, label: typed };
    if (rule) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), { entry, rule }]);
  }

  const rows: TimesheetRow[] = [];
  for (const date of daysOfMonth(month)) {
    const jobs = byDate.get(date);
    if (!jobs) continue;
    const hours = { t: 0, t15: 0, t2: 0, t3: 0 };
    for (const { entry } of jobs) {
      if (isOther(entry)) { hours.t += otherHours(entry); continue; }
      const site = findSite(valueOn(history.sites, date), entry.site);
      const pay = site ? computeDay(entry, valueOn(history.sites, date)) : undefined;
      const tiers = pay?.tierHours ?? { x1: 0, x15: 0, x2: 0, x3: 0 };
      const tierTotal = tiers.x1 + tiers.x15 + tiers.x2 + tiers.x3;
      // A flat-pay site with no overtime caps has no tiers to split by, so everything is straight time.
      if (tierTotal === 0) hours.t += entry.hours;
      else { hours.t += tiers.x1; hours.t15 += tiers.x15; hours.t2 += tiers.x2; hours.t3 += tiers.x3; }
    }
    const starts = jobs.map((j) => j.entry.startTime).filter((t): t is string => !!t).sort();
    const ends = jobs.map((j) => j.entry.endTime).filter((t): t is string => !!t);
    const clients = [...new Set(jobs.map((j) => j.rule.label))];

    // Start and end time are required for a job at a site, but optional for an other job.
    if (jobs.some((j) => !isOther(j.entry) && (!j.entry.startTime || !j.entry.endTime))) warnings.push(`${dayLabel(date)}: start or end time is missing.`);
    if (jobs.length > 1) warnings.push(`${dayLabel(date)}: ${jobs.length} jobs share one row (hours added together).`);

    rows.push({
      date,
      onDuty: starts[0],
      offDuty: jobs.length === 1 ? ends[0] : ends.sort().at(-1),
      hours,
      client: clients.join(" / "),
      entryIds: jobs.map((j) => j.entry.id),
    });
  }
  return { rows, warnings };
}

/** The timesheet choices read out as a sentence, so it is clear what goes on the form. */
export function timesheetSummary(rules: TimesheetRule[], siteNames: string[], includeOther: boolean, medicEverywhere: boolean): string {
  const whole = rules.filter((r) => !r.role);
  const wholeSites = new Set(whole.map((r) => r.site.toLowerCase()));
  const parts: string[] = [];
  for (const r of whole) parts.push(`every day at ${r.site}`);
  const roleParts = rules.filter((r) => r.role && !wholeSites.has(r.site.toLowerCase())).map((r) => `${r.role!.toLowerCase()} days at ${r.site}`);
  parts.push(...roleParts);
  if (medicEverywhere) parts.push("client medic days at every other site");
  if (includeOther) parts.push("other jobs");
  const off = siteNames.filter((n) => !wholeSites.has(n.toLowerCase()) && !rules.some((r) => r.role && same(r.site, n)));
  const on = parts.length ? `On your timesheet: ${parts.join("; ")}.` : "Nothing is on your timesheet yet.";
  const wholeOff = off;
  return wholeOff.length ? `${on} Other work at ${wholeOff.slice(0, 4).join(", ")}${wholeOff.length > 4 ? " and more" : ""} stays off.` : on;
}
