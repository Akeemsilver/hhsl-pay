import type { Dated, SiteRates, SiteTable, TierCaps } from "./engine";
import { FIRST_VERSION_DATE } from "./model";

const clone = <T,>(v: T): T => structuredClone(v);

/**
 * Makes a rate change "take effect from" a date. A new version starts on that date (a copy of the rates in force then),
 * and the change is applied to it and to every later version, so nothing after the date keeps the old numbers.
 * Days before the date keep their old rates. A date at or before the first version changes everything.
 */
export function applyFrom<T = SiteTable>(versions: Array<Dated<T>>, date: string, mutate: (t: T) => T): Array<Dated<T>> {
  const sorted = [...versions].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const first = sorted[0]?.effectiveFrom ?? FIRST_VERSION_DATE;
  let list = sorted;
  if (date > first && !sorted.some((v) => v.effectiveFrom === date)) {
    const base = [...sorted].reverse().find((v) => v.effectiveFrom <= date) ?? sorted[0]!;
    list = [...sorted, { effectiveFrom: date, value: clone(base.value) }].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  }
  return list.map((v) => (v.effectiveFrom >= date || date <= first ? { ...v, value: mutate(clone(v.value)) } : v));
}

/** The settings that differ between what is saved and the edited copy. */
export function diffObject<T extends object>(saved: T, draft: T): Partial<T> {
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(saved), ...Object.keys(draft)]) as Set<keyof T>;
  for (const k of keys) if (JSON.stringify(saved[k]) !== JSON.stringify(draft[k])) patch[k as string] = draft[k];
  return patch as Partial<T>;
}

export const diffSite = (saved: SiteRates, draft: SiteRates): Partial<SiteRates> => diffObject(saved, draft);

/** Applies a site change to a table: patch the site's changed settings, or add the whole site if that version lacks it. */
export function patchSite(table: SiteTable, name: string, patch: Partial<SiteRates>, whole: SiteRates): SiteTable {
  const existing = table[name];
  return { ...table, [name]: existing ? { ...existing, ...patch } : clone(whole) };
}

/** A site can be changed in bulk when it is paid by the hour at a normal rate (not flat pay with a threshold rate). */
export function isHourlySite(s: SiteRates): boolean {
  return (s.baseRate ?? 0) > 0 && !((s.showRateAboveHrs ?? 0) > 0);
}

export interface GroupChange {
  baseRate?: number;
  leadRate?: number;
  caps?: { weekday: TierCaps; weekend: TierCaps; holiday: TierCaps };
}

/** Which sites belong to a payslip group and would change, or be left alone because they are not paid by the hour. */
export function groupSites(table: SiteTable, payer: string): { change: string[]; skip: string[] } {
  const change: string[] = [], skip: string[] = [];
  for (const [name, s] of Object.entries(table)) {
    if (s.payer !== payer) continue;
    (isHourlySite(s) ? change : skip).push(name);
  }
  return { change, skip };
}

/** One change for every hourly site in a payslip group. */
export function changeGroup(table: SiteTable, payer: string, c: GroupChange): SiteTable {
  return Object.fromEntries(Object.entries(table).map(([name, s]) => {
    if (s.payer !== payer || !isHourlySite(s)) return [name, s];
    const next: SiteRates = { ...s };
    if (c.baseRate !== undefined) next.baseRate = c.baseRate;
    if (c.leadRate !== undefined) next.leadRate = c.leadRate;
    if (c.caps) { next.weekday = { ...c.caps.weekday }; next.weekend = { ...c.caps.weekend }; next.holiday = { ...c.caps.holiday }; }
    return [name, next];
  }));
}

/** The value most sites in a group share, so the group box can show "60" when they all agree. */
export function commonValue<T>(values: T[]): T | undefined {
  const counts = new Map<string, { v: T; n: number }>();
  for (const v of values) {
    const k = JSON.stringify(v);
    const e = counts.get(k) ?? { v, n: 0 };
    e.n++;
    counts.set(k, e);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.v;
}
